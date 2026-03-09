import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as xlsx from "xlsx";

function normalizeString(str: unknown): string {
  if (!str) return "";
  return String(str)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se encontró ningún archivo" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Extract rows as JSON array of arrays, and then parse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío o no tiene encabezados" }, { status: 400 });
    }

    const headers = data[0].map((h: unknown) => normalizeString(h));

    const idxDepto = headers.findIndex((h) => h.includes("DEPARTAMENTO") || h.includes("DEPTO") || h.includes("DPTO"));
    const idxMuni = headers.findIndex((h) => h.includes("MUNICIPIO") || h.includes("MUNI") || h.includes("CIUDAD"));
    const idxPuesto = headers.findIndex((h) => h.includes("PUESTO") || h.includes("LUGAR") || h.includes("CENTRO"));
    const idxEstimado = headers.findIndex((h) =>
      (h.includes("ESTIMADO") || h.includes("META") || h.includes("VOTOS")) &&
      !h.includes("POTENCIAL") && !h.includes("POSIBLE")
    );
    const idxPotencial = headers.findIndex((h) =>
      h.includes("POTENCIAL") || h.includes("CENSO") || h.includes("INSCRITOS") ||
      h.includes("HABILITADOS") || h.includes("POSIBLE")
    );

    if (idxDepto === -1 || idxMuni === -1 || idxPuesto === -1) {
      return NextResponse.json({
        error: "El Excel debe contener las columnas: DEPARTAMENTO, MUNICIPIO, PUESTO. Opcionalmente: ESTIMADO y/o POTENCIAL"
      }, { status: 400 });
    }

    if (idxEstimado === -1 && idxPotencial === -1) {
      return NextResponse.json({
        error: "El Excel debe contener al menos una de estas columnas: ESTIMADO (votos estimados) o POTENCIAL (potencial electoral)"
      }, { status: 400 });
    }

    // Cache to minimize DB queries
    // We fetch all Puestos with their relations
    const allPuestos = await prisma.puesto.findMany({
      include: {
        zona: {
          include: {
            municipio: {
              include: {
                departamento: true
              }
            }
          }
        }
      }
    });

    // Create a fast lookup map: "DEPTO|MUNI|PUESTO" -> puestoId
    const puestoMap = new Map<string, number>();
    for (const p of allPuestos) {
      const depto = normalizeString(p.zona.municipio.departamento.nombre);
      const muni = normalizeString(p.zona.municipio.nombre);
      const puestoNombre = normalizeString(p.nombre);
      puestoMap.set(`${depto}|${muni}|${puestoNombre}`, p.id);
    }

    let actualizados = 0;
    let noEncontrados = 0;

    const updates: { id: number; estimado: number | null; potencial: number | null }[] = [];

    // Parse rows
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const depto = normalizeString(row[idxDepto]);
      const muni = normalizeString(row[idxMuni]);
      const puesto = normalizeString(row[idxPuesto]);

      if (!depto || !muni || !puesto) continue;

      const estimado = idxEstimado !== -1 ? parseInt(row[idxEstimado]) : null;
      const potencial = idxPotencial !== -1 ? parseInt(row[idxPotencial]) : null;

      // Skip row if neither value is valid
      if ((estimado === null || isNaN(estimado)) && (potencial === null || isNaN(potencial))) continue;

      const key = `${depto}|${muni}|${puesto}`;
      const puestoId = puestoMap.get(key);

      if (puestoId) {
        updates.push({
          id: puestoId,
          estimado: estimado !== null && !isNaN(estimado) ? estimado : null,
          potencial: potencial !== null && !isNaN(potencial) ? potencial : null,
        });
        actualizados++;
      } else {
        noEncontrados++;
      }
    }

    // Process updates in transaction
    if (updates.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(
          batch.map(u =>
            prisma.puesto.update({
              where: { id: u.id },
              data: {
                ...(u.estimado !== null ? { estimadoVotos: u.estimado } : {}),
                ...(u.potencial !== null ? { potencialElectoral: u.potencial } : {}),
              }
            })
          )
        );
      }
    }

    return NextResponse.json({
      success: true,
      actualizados,
      noEncontrados,
      total: data.length - 1
    });
    
  } catch (error) {
    console.error("Error al procesar el Excel:", error);
    return NextResponse.json({ error: "Error interno procesando el archivo" }, { status: 500 });
  }
}
