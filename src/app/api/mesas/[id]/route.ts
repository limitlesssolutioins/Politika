import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mesaId = parseInt(id);

  const mesa = await prisma.mesa.findUnique({
    where: { id: mesaId },
    include: {
      puesto: {
        include: {
          zona: {
            include: {
              municipio: {
                include: {
                  departamento: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!mesa) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }

  const votos = await prisma.voto.findMany({
    where: { mesaId },
    include: {
      corporacion: { select: { id: true, nombre: true } },
      partido: { select: { id: true, nombre: true, codigo: true } },
      candidato: { select: { id: true, nombre: true, codigo: true } },
    },
    orderBy: [{ corporacionId: "asc" }, { totalVotos: "desc" }],
  });

  const totalVotos = votos.reduce((sum, v) => sum + v.totalVotos, 0);

  // Group by corporacion
  const porCorporacion: Record<string, { corporacion: string; votos: typeof votos; total: number }> = {};
  for (const v of votos) {
    const key = v.corporacion.nombre;
    if (!porCorporacion[key]) {
      porCorporacion[key] = { corporacion: key, votos: [], total: 0 };
    }
    porCorporacion[key].votos.push(v);
    porCorporacion[key].total += v.totalVotos;
  }

  return NextResponse.json({
    mesa: {
      id: mesa.id,
      numero: mesa.numero,
      potencialElectoral: mesa.potencialElectoral,
      estimadoVotos: mesa.estimadoVotos,
      puesto: mesa.puesto.nombre,
      zona: mesa.puesto.zona.codigo,
      municipio: mesa.puesto.zona.municipio.nombre,
      departamento: mesa.puesto.zona.municipio.departamento.nombre,
    },
    totalVotos,
    totalRegistros: votos.length,
    porCorporacion: Object.values(porCorporacion),
    votos,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mesaId = parseInt(id);

  try {
    const body = await request.json();
    const estimadoVotos = body.estimadoVotos === null || body.estimadoVotos === "" 
      ? null 
      : parseInt(body.estimadoVotos);

    if (estimadoVotos !== null && isNaN(estimadoVotos)) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const updatedMesa = await prisma.mesa.update({
      where: { id: mesaId },
      data: { estimadoVotos },
    });

    return NextResponse.json({ success: true, estimadoVotos: updatedMesa.estimadoVotos });
  } catch (error) {
    console.error("Error updating estimadoVotos:", error);
    return NextResponse.json({ error: "Error al actualizar la mesa" }, { status: 500 });
  }
}

