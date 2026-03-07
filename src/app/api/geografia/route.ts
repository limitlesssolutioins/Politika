import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nivel = searchParams.get("nivel") || "departamentos";
  const parentId = searchParams.get("parentId");
  const search = searchParams.get("search") || "";

  if (nivel === "departamentos") {
    const departamentos = await prisma.departamento.findMany({
      where: search ? { nombre: { contains: search } } : undefined,
      include: {
        _count: { select: { municipios: true } },
      },
      orderBy: { nombre: "asc" },
    });

    // Get vote totals per department from summaries
    const resumenes = await prisma.resumenDepartamento.groupBy({
      by: ["departamentoId"],
      _sum: { totalVotos: true },
    });
    const resMap = new Map(resumenes.map((r) => [r.departamentoId, r._sum.totalVotos ?? 0]));

    const result = departamentos.map((d) => ({
      id: d.id,
      codigo: d.codigo,
      nombre: d.nombre,
      totalMunicipios: d._count.municipios,
      totalVotos: resMap.get(d.id) ?? 0,
    }));

    return NextResponse.json(result);
  }

  if (nivel === "municipios" && parentId) {
    const municipios = await prisma.municipio.findMany({
      where: {
        departamentoId: parseInt(parentId),
        ...(search ? { nombre: { contains: search } } : {}),
      },
      include: {
        _count: { select: { zonas: true } },
        departamento: { select: { nombre: true } },
      },
      orderBy: { nombre: "asc" },
    });

    const resumenes = await prisma.resumenMunicipio.groupBy({
      by: ["municipioId"],
      where: { municipioId: { in: municipios.map((m) => m.id) } },
      _sum: { totalVotos: true },
    });
    const resMap = new Map(resumenes.map((r) => [r.municipioId, r._sum.totalVotos ?? 0]));

    const result = municipios.map((m) => ({
      id: m.id,
      codigo: m.codigo,
      nombre: m.nombre,
      departamento: m.departamento.nombre,
      totalZonas: m._count.zonas,
      totalVotos: resMap.get(m.id) ?? 0,
    }));

    return NextResponse.json(result);
  }

  if (nivel === "puestos" && parentId) {
    const zonas = await prisma.zona.findMany({
      where: { municipioId: parseInt(parentId) },
      select: { id: true },
    });
    const zonaIds = zonas.map((z) => z.id);

    const puestos = await prisma.puesto.findMany({
      where: {
        zonaId: { in: zonaIds },
        ...(search ? { nombre: { contains: search } } : {}),
      },
      include: {
        _count: { select: { mesas: true } },
        zona: {
          include: {
            municipio: { select: { nombre: true } },
          },
        },
      },
      orderBy: { nombre: "asc" },
    });

    // Get vote totals per puesto
    const puestoVotos = await Promise.all(
      puestos.map(async (p) => {
        const mesas = await prisma.mesa.findMany({
          where: { puestoId: p.id },
          select: { id: true },
        });
        const total = await prisma.voto.aggregate({
          where: { mesaId: { in: mesas.map((m) => m.id) } },
          _sum: { totalVotos: true },
        });
        return { puestoId: p.id, total: total._sum.totalVotos ?? 0 };
      })
    );
    const votosMap = new Map(puestoVotos.map((v) => [v.puestoId, v.total]));

    const result = puestos.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      zona: p.zona.codigo,
      municipio: p.zona.municipio.nombre,
      totalMesas: p._count.mesas,
      totalVotos: votosMap.get(p.id) ?? 0,
    }));

    return NextResponse.json(result);
  }

  if (nivel === "mesas" && parentId) {
    const mesas = await prisma.mesa.findMany({
      where: { puestoId: parseInt(parentId) },
      include: {
        puesto: { select: { nombre: true } },
      },
      orderBy: { numero: "asc" },
    });

    const mesaVotos = await prisma.voto.groupBy({
      by: ["mesaId"],
      where: { mesaId: { in: mesas.map((m) => m.id) } },
      _sum: { totalVotos: true },
    });
    const votosMap = new Map(mesaVotos.map((v) => [v.mesaId, v._sum.totalVotos ?? 0]));

    const result = mesas.map((m) => ({
      id: m.id,
      numero: m.numero,
      puesto: m.puesto.nombre,
      potencialElectoral: m.potencialElectoral,
      totalVotos: votosMap.get(m.id) ?? 0,
    }));

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
}
