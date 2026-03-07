import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partidoId = searchParams.get("partidoId");
  const corporacionId = searchParams.get("corporacionId");
  const nivel = searchParams.get("nivel");

  const where: Record<string, unknown> = {};
  if (partidoId) where.partidoId = parseInt(partidoId);
  if (corporacionId) where.corporacionId = parseInt(corporacionId);
  if (nivel) where.nivel = nivel;

  const objetivos = await prisma.objetivoCampana.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      partido: { select: { id: true, nombre: true } },
      corporacion: { select: { id: true, nombre: true } },
    },
    orderBy: { id: "desc" },
  });

  // Calculate actual votes for each objective
  const enriched = await Promise.all(
    objetivos.map(async (obj) => {
      let votosReales = 0;

      if (obj.nivel === "departamento") {
        const res = await prisma.resumenDepartamento.aggregate({
          where: {
            departamentoId: obj.nivelId,
            partidoId: obj.partidoId,
            corporacionId: obj.corporacionId,
          },
          _sum: { totalVotos: true },
        });
        votosReales = res._sum.totalVotos ?? 0;
      } else if (obj.nivel === "municipio") {
        const res = await prisma.resumenMunicipio.aggregate({
          where: {
            municipioId: obj.nivelId,
            partidoId: obj.partidoId,
            corporacionId: obj.corporacionId,
          },
          _sum: { totalVotos: true },
        });
        votosReales = res._sum.totalVotos ?? 0;
      }

      const cumplimiento = obj.metaVotos > 0 ? (votosReales / obj.metaVotos) * 100 : 0;

      return {
        ...obj,
        votosReales,
        cumplimiento: Math.round(cumplimiento * 100) / 100,
        cumplido: votosReales >= obj.metaVotos,
      };
    })
  );

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nivel, nivelId, partidoId, corporacionId, metaVotos } = body;

  if (!nivel || !nivelId || !partidoId || !corporacionId || !metaVotos) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  const objetivo = await prisma.objetivoCampana.upsert({
    where: {
      nivel_nivelId_partidoId_corporacionId: {
        nivel,
        nivelId: parseInt(nivelId),
        partidoId: parseInt(partidoId),
        corporacionId: parseInt(corporacionId),
      },
    },
    update: { metaVotos: parseInt(metaVotos) },
    create: {
      nivel,
      nivelId: parseInt(nivelId),
      partidoId: parseInt(partidoId),
      corporacionId: parseInt(corporacionId),
      metaVotos: parseInt(metaVotos),
    },
  });

  return NextResponse.json(objetivo, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await prisma.objetivoCampana.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
