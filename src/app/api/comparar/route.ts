import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partidoIds = searchParams.get("partidoIds")?.split(",").map(Number).filter(Boolean) || [];
  const corporacionId = searchParams.get("corporacionId");

  if (partidoIds.length < 2) {
    return NextResponse.json({ error: "Se requieren al menos 2 partidos" }, { status: 400 });
  }

  // Get party info
  const partidos = await prisma.partido.findMany({
    where: { id: { in: partidoIds } },
  });

  // Nacional totals per party
  const totalesNacionales = await prisma.resumenDepartamento.groupBy({
    by: ["partidoId"],
    where: {
      partidoId: { in: partidoIds },
      ...(corporacionId ? { corporacionId: parseInt(corporacionId) } : {}),
    },
    _sum: { totalVotos: true },
  });

  // Per department breakdown
  const porDepartamento = await prisma.resumenDepartamento.findMany({
    where: {
      partidoId: { in: partidoIds },
      ...(corporacionId ? { corporacionId: parseInt(corporacionId) } : {}),
    },
    include: {
      departamento: { select: { id: true, nombre: true } },
      partido: { select: { id: true, nombre: true } },
    },
    orderBy: { totalVotos: "desc" },
  });

  // Group by department for comparison chart
  const deptMap = new Map<string, Record<string, unknown>>();
  for (const r of porDepartamento) {
    const deptName = r.departamento.nombre;
    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, { departamento: deptName });
    }
    const entry = deptMap.get(deptName)!;
    const currentTotal = (entry[r.partido.nombre] as number) || 0;
    entry[r.partido.nombre] = currentTotal + r.totalVotos;
  }

  // Per corporacion breakdown
  const porCorporacion = await prisma.resumenDepartamento.groupBy({
    by: ["partidoId", "corporacionId"],
    where: { partidoId: { in: partidoIds } },
    _sum: { totalVotos: true },
  });

  const corpIds = [...new Set(porCorporacion.map((r) => r.corporacionId))];
  const corporaciones = await prisma.corporacion.findMany({
    where: { id: { in: corpIds } },
  });
  const corpMap = new Map(corporaciones.map((c) => [c.id, c.nombre]));

  // Build corporacion comparison
  const corpComparison = new Map<string, Record<string, unknown>>();
  for (const r of porCorporacion) {
    const corpName = corpMap.get(r.corporacionId) || "";
    if (!corpComparison.has(corpName)) {
      corpComparison.set(corpName, { corporacion: corpName });
    }
    const partidoName = partidos.find((p) => p.id === r.partidoId)?.nombre || "";
    const entry = corpComparison.get(corpName)!;
    entry[partidoName] = r._sum.totalVotos ?? 0;
  }

  // Sort departments by total votes desc
  const deptData = Array.from(deptMap.values()).sort((a, b) => {
    const totalA = Object.values(a).reduce((sum: number, v) => sum + (typeof v === "number" ? v : 0), 0);
    const totalB = Object.values(b).reduce((sum: number, v) => sum + (typeof v === "number" ? v : 0), 0);
    return totalB - totalA;
  });

  return NextResponse.json({
    partidos,
    totalesNacionales: totalesNacionales.map((t) => ({
      partidoId: t.partidoId,
      nombre: partidos.find((p) => p.id === t.partidoId)?.nombre || "",
      totalVotos: t._sum.totalVotos ?? 0,
    })),
    porDepartamento: deptData.slice(0, 15),
    porCorporacion: Array.from(corpComparison.values()),
  });
}
