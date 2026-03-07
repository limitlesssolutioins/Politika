import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") || "por-partido";
  const corporacionId = searchParams.get("corporacionId");
  const departamentoId = searchParams.get("departamentoId");
  const municipioId = searchParams.get("municipioId");
  const partidoId = searchParams.get("partidoId");
  const candidatoId = searchParams.get("candidatoId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const skip = (page - 1) * limit;

  if (tipo === "por-partido") {
    const where: Record<string, unknown> = {};
    if (corporacionId) where.corporacionId = parseInt(corporacionId);
    if (departamentoId) where.departamentoId = parseInt(departamentoId);

    // Use ResumenDepartamento for department-level aggregation
    if (departamentoId && !municipioId) {
      const data = await prisma.resumenDepartamento.findMany({
        where: {
          departamentoId: parseInt(departamentoId),
          ...(corporacionId ? { corporacionId: parseInt(corporacionId) } : {}),
        },
        include: {
          partido: { select: { id: true, codigo: true, nombre: true } },
          corporacion: { select: { id: true, nombre: true } },
        },
        orderBy: { totalVotos: "desc" },
        skip,
        take: limit,
      });

      const total = await prisma.resumenDepartamento.count({
        where: {
          departamentoId: parseInt(departamentoId),
          ...(corporacionId ? { corporacionId: parseInt(corporacionId) } : {}),
        },
      });

      return NextResponse.json({
        data: data.map((d) => ({
          partido: d.partido,
          corporacion: d.corporacion,
          totalVotos: d.totalVotos,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    // Use ResumenMunicipio for municipal-level
    if (municipioId) {
      const data = await prisma.resumenMunicipio.findMany({
        where: {
          municipioId: parseInt(municipioId),
          ...(corporacionId ? { corporacionId: parseInt(corporacionId) } : {}),
        },
        include: {
          partido: { select: { id: true, codigo: true, nombre: true } },
          corporacion: { select: { id: true, nombre: true } },
        },
        orderBy: { totalVotos: "desc" },
        skip,
        take: limit,
      });

      const total = await prisma.resumenMunicipio.count({
        where: {
          municipioId: parseInt(municipioId),
          ...(corporacionId ? { corporacionId: parseInt(corporacionId) } : {}),
        },
      });

      return NextResponse.json({
        data: data.map((d) => ({
          partido: d.partido,
          corporacion: d.corporacion,
          totalVotos: d.totalVotos,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    // National level: aggregate from ResumenDepartamento
    const data = await prisma.resumenDepartamento.groupBy({
      by: ["partidoId"],
      where: corporacionId ? { corporacionId: parseInt(corporacionId) } : undefined,
      _sum: { totalVotos: true },
      orderBy: { _sum: { totalVotos: "desc" } },
      skip,
      take: limit,
    });

    const partidoIds = data.map((d) => d.partidoId);
    const partidos = await prisma.partido.findMany({
      where: { id: { in: partidoIds } },
    });
    const pMap = new Map(partidos.map((p) => [p.id, p]));

    return NextResponse.json({
      data: data.map((d) => ({
        partido: pMap.get(d.partidoId),
        totalVotos: d._sum.totalVotos ?? 0,
      })),
      pagination: { page, limit, total: data.length, totalPages: 1 },
    });
  }

  if (tipo === "por-candidato") {
    const whereVoto: Record<string, unknown> = {};
    if (corporacionId) whereVoto.corporacionId = parseInt(corporacionId);
    if (partidoId) whereVoto.partidoId = parseInt(partidoId);

    const data = await prisma.voto.groupBy({
      by: ["candidatoId", "corporacionId"],
      where: Object.keys(whereVoto).length > 0 ? whereVoto : undefined,
      _sum: { totalVotos: true },
      orderBy: { _sum: { totalVotos: "desc" } },
      skip,
      take: limit,
    });

    const candIds = data.map((d) => d.candidatoId);
    const corpIds = data.map((d) => d.corporacionId);
    const [candidatos, corporaciones] = await Promise.all([
      prisma.candidato.findMany({
        where: { id: { in: candIds } },
        include: { partido: { select: { nombre: true } } },
      }),
      prisma.corporacion.findMany({ where: { id: { in: corpIds } } }),
    ]);
    const cMap = new Map(candidatos.map((c) => [c.id, c]));
    const coMap = new Map(corporaciones.map((c) => [c.id, c]));

    return NextResponse.json({
      data: data.map((d) => ({
        candidato: {
          id: d.candidatoId,
          nombre: cMap.get(d.candidatoId)?.nombre ?? "",
          codigo: cMap.get(d.candidatoId)?.codigo ?? "",
          partido: cMap.get(d.candidatoId)?.partido?.nombre ?? "",
        },
        corporacion: coMap.get(d.corporacionId),
        totalVotos: d._sum.totalVotos ?? 0,
      })),
      pagination: { page, limit },
    });
  }

  if (tipo === "por-corporacion") {
    const data = await prisma.voto.groupBy({
      by: ["corporacionId"],
      _sum: { totalVotos: true },
      orderBy: { _sum: { totalVotos: "desc" } },
    });

    const corpIds = data.map((d) => d.corporacionId);
    const corporaciones = await prisma.corporacion.findMany({
      where: { id: { in: corpIds } },
    });
    const coMap = new Map(corporaciones.map((c) => [c.id, c]));

    return NextResponse.json({
      data: data.map((d) => ({
        corporacion: coMap.get(d.corporacionId),
        totalVotos: d._sum.totalVotos ?? 0,
      })),
    });
  }

  if (tipo === "por-mesa") {
    const mesaId = searchParams.get("mesaId");
    if (!mesaId) return NextResponse.json({ error: "mesaId requerido" }, { status: 400 });

    const votos = await prisma.voto.findMany({
      where: { mesaId: parseInt(mesaId) },
      include: {
        corporacion: { select: { nombre: true } },
        partido: { select: { nombre: true } },
        candidato: { select: { nombre: true } },
      },
      orderBy: { totalVotos: "desc" },
    });

    return NextResponse.json({ data: votos });
  }

  return NextResponse.json({ error: "Tipo de consulta inválido" }, { status: 400 });
}
