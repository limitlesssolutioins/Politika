import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [
    totalMesas,
    totalVotosResult,
    totalDepartamentos,
    totalMunicipios,
    totalPuestos,
    corporaciones,
    topPartidos,
    votosPorDepartamento,
  ] = await Promise.all([
    prisma.mesa.count(),
    prisma.voto.aggregate({ _sum: { totalVotos: true } }),
    prisma.departamento.count(),
    prisma.municipio.count(),
    prisma.puesto.count(),
    prisma.corporacion.findMany({
      include: {
        _count: { select: { votos: true } },
      },
    }),
    prisma.resumenDepartamento.groupBy({
      by: ["partidoId"],
      _sum: { totalVotos: true },
      orderBy: { _sum: { totalVotos: "desc" } },
      take: 10,
    }),
    prisma.resumenDepartamento.groupBy({
      by: ["departamentoId"],
      _sum: { totalVotos: true },
      orderBy: { _sum: { totalVotos: "desc" } },
    }),
  ]);

  // Enrich top partidos with names
  const partidoIds = topPartidos.map((p) => p.partidoId);
  const partidos = await prisma.partido.findMany({
    where: { id: { in: partidoIds } },
  });
  const partidoMap = new Map(partidos.map((p) => [p.id, p]));

  const topPartidosEnriched = topPartidos.map((p) => ({
    id: p.partidoId,
    nombre: partidoMap.get(p.partidoId)?.nombre ?? "",
    codigo: partidoMap.get(p.partidoId)?.codigo ?? "",
    totalVotos: p._sum.totalVotos ?? 0,
  }));

  // Enrich departamentos
  const deptIds = votosPorDepartamento.map((d) => d.departamentoId);
  const departamentos = await prisma.departamento.findMany({
    where: { id: { in: deptIds } },
  });
  const deptMap = new Map(departamentos.map((d) => [d.id, d]));

  const votosPorDeptEnriched = votosPorDepartamento.map((d) => ({
    id: d.departamentoId,
    nombre: deptMap.get(d.departamentoId)?.nombre ?? "",
    totalVotos: d._sum.totalVotos ?? 0,
  }));

  // Corporaciones enriched
  const corpEnriched = corporaciones.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    codigo: c.codigo,
    totalRegistros: c._count.votos,
  }));

  return NextResponse.json({
    totalMesas,
    totalVotos: totalVotosResult._sum.totalVotos ?? 0,
    totalDepartamentos,
    totalMunicipios,
    totalPuestos,
    corporaciones: corpEnriched,
    topPartidos: topPartidosEnriched,
    votosPorDepartamento: votosPorDeptEnriched,
  });
}
