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
    const { searchParams } = new URL(request.url);
    // tipo=estimado → actualiza estimadoVotos
    // tipo=e14      → actualiza votosE14Real
    const tipo = searchParams.get("tipo") || "estimado";

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se encontró ningún archivo" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío o no tiene encabezados" }, { status: 400 });
    }

    const headers = data[0].map((h: unknown) => normalizeString(h));

    const idxDepto  = headers.findIndex(h => h.includes("DEPARTAMENTO") || h.includes("DEPTO") || h.includes("DPTO"));
    const idxMuni   = headers.findIndex(h => h.includes("MUNICIPIO") || h.includes("MUNI") || h.includes("CIUDAD"));
    const idxPuesto = headers.findIndex(h => h.includes("PUESTO") || h.includes("LUGAR") || h.includes("CENTRO"));
    const idxVotos  = headers.findIndex(h =>
      h.includes("ESTIMADO") || h.includes("META") || h.includes("VOTOS") ||
      h.includes("TOTAL") || h.includes("RESULTADO")
    );

    if (idxDepto === -1 || idxMuni === -1 || idxPuesto === -1) {
      return NextResponse.json({
        error: `El Excel debe tener columnas: DEPARTAMENTO, MUNICIPIO, PUESTO, ${tipo === "e14" ? "VOTOS" : "ESTIMADO"}`,
      }, { status: 400 });
    }

    if (idxVotos === -1) {
      return NextResponse.json({
        error: `No se encontró la columna de ${tipo === "e14" ? "VOTOS / TOTAL / RESULTADO" : "ESTIMADO / META / VOTOS"}`,
      }, { status: 400 });
    }

    // Cache de puestos: clave "DEPTO|MUNI|PUESTO" → id
    const allPuestos = await prisma.puesto.findMany({
      include: {
        zona: { include: { municipio: { include: { departamento: true } } } }
      }
    });

    const puestoMap = new Map<string, number>();
    for (const p of allPuestos) {
      const depto  = normalizeString(p.zona.municipio.departamento.nombre);
      const muni   = normalizeString(p.zona.municipio.nombre);
      const nombre = normalizeString(p.nombre);
      puestoMap.set(`${depto}|${muni}|${nombre}`, p.id);
    }

    let actualizados = 0;
    let noEncontrados = 0;
    const updates: { id: number; votos: number }[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const depto  = normalizeString(row[idxDepto]);
      const muni   = normalizeString(row[idxMuni]);
      const puesto = normalizeString(row[idxPuesto]);
      const votos  = parseInt(row[idxVotos]);

      if (!depto || !muni || !puesto || isNaN(votos)) continue;

      const puestoId = puestoMap.get(`${depto}|${muni}|${puesto}`);
      if (puestoId) {
        updates.push({ id: puestoId, votos });
        actualizados++;
      } else {
        noEncontrados++;
      }
    }

    if (updates.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(
          batch.map(u =>
            prisma.puesto.update({
              where: { id: u.id },
              data: tipo === "e14"
                ? { votosE14Real: u.votos }
                : { estimadoVotos: u.votos },
            })
          )
        );
      }
    }

    return NextResponse.json({
      success: true,
      tipo,
      actualizados,
      noEncontrados,
      total: data.length - 1,
    });

  } catch (error) {
    console.error("Error al procesar el Excel:", error);
    return NextResponse.json({ error: "Error interno procesando el archivo" }, { status: 500 });
  }
}
