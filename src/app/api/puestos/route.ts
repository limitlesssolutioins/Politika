import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nivel = searchParams.get("nivel") || "departamentos";
  const parentId = searchParams.get("parentId");

  try {
    if (nivel === "departamentos") {
      const deptos = await prisma.departamento.findMany({ orderBy: { nombre: "asc" } });

      // Potencial = votos del E14 viejo ya en BD (suma real de participación anterior)
      const potencialRaw = await prisma.$queryRaw<Array<{ departamentoId: number; total: number }>>`
        SELECT mu.departamentoId, CAST(COALESCE(SUM(v.totalVotos), 0) AS INTEGER) as total
        FROM Voto v
        JOIN Mesa m ON v.mesaId = m.id
        JOIN Puesto p ON m.puestoId = p.id
        JOIN Zona z ON p.zonaId = z.id
        JOIN Municipio mu ON z.municipioId = mu.id
        GROUP BY mu.departamentoId
      `;
      const potencialMap = new Map<number, number>(
        potencialRaw.map(r => [r.departamentoId, Number(r.total) || 0])
      );

      // Estimado y votos E14 nuevo desde Puesto directamente
      const puestosAgg = await prisma.$queryRaw<Array<{
        departamentoId: number;
        totalPuestos: number;
        totalEstimado: number;
        totalVotosReales: number;
        totalMesas: number;
      }>>`
        SELECT
          mu.departamentoId,
          COUNT(DISTINCT p.id)                            AS totalPuestos,
          CAST(COALESCE(SUM(p.estimadoVotos), 0) AS INTEGER)  AS totalEstimado,
          CAST(COALESCE(SUM(p.votosE14Real), 0) AS INTEGER)   AS totalVotosReales,
          COUNT(DISTINCT me.id)                           AS totalMesas
        FROM Puesto p
        JOIN Zona z ON p.zonaId = z.id
        JOIN Municipio mu ON z.municipioId = mu.id
        LEFT JOIN Mesa me ON me.puestoId = p.id
        GROUP BY mu.departamentoId
      `;
      const puestosMap = new Map<number, typeof puestosAgg[0]>(
        puestosAgg.map(r => [r.departamentoId, r])
      );

      const result = deptos.map(d => {
        const agg = puestosMap.get(d.id);
        return {
          id: d.id,
          nombre: d.nombre,
          totalPuestos:     Number(agg?.totalPuestos)     || 0,
          totalEstimado:    Number(agg?.totalEstimado)    || 0,
          totalPosible:     potencialMap.get(d.id)        || 0,
          totalMesas:       Number(agg?.totalMesas)       || 0,
          totalVotosReales: Number(agg?.totalVotosReales) || 0,
        };
      });

      return NextResponse.json(result);
    }

    if (nivel === "municipios" && parentId) {
      const deptoId = parseInt(parentId);
      const municipios = await prisma.municipio.findMany({
        where: { departamentoId: deptoId },
        orderBy: { nombre: "asc" }
      });

      // Potencial = E14 viejo por municipio
      const potencialRaw = await prisma.$queryRaw<Array<{ municipioId: number; total: number }>>`
        SELECT z.municipioId, CAST(COALESCE(SUM(v.totalVotos), 0) AS INTEGER) as total
        FROM Voto v
        JOIN Mesa m ON v.mesaId = m.id
        JOIN Puesto p ON m.puestoId = p.id
        JOIN Zona z ON p.zonaId = z.id
        JOIN Municipio mu ON z.municipioId = mu.id
        WHERE mu.departamentoId = ${deptoId}
        GROUP BY z.municipioId
      `;
      const potencialMap = new Map<number, number>(
        potencialRaw.map(r => [r.municipioId, Number(r.total) || 0])
      );

      // Estimado, E14 nuevo y conteos por municipio
      const puestosAgg = await prisma.$queryRaw<Array<{
        municipioId: number;
        totalPuestos: number;
        totalEstimado: number;
        totalVotosReales: number;
        totalMesas: number;
      }>>`
        SELECT
          z.municipioId,
          COUNT(DISTINCT p.id)                            AS totalPuestos,
          CAST(COALESCE(SUM(p.estimadoVotos), 0) AS INTEGER)  AS totalEstimado,
          CAST(COALESCE(SUM(p.votosE14Real), 0) AS INTEGER)   AS totalVotosReales,
          COUNT(DISTINCT me.id)                           AS totalMesas
        FROM Puesto p
        JOIN Zona z ON p.zonaId = z.id
        JOIN Municipio mu ON z.municipioId = mu.id
        LEFT JOIN Mesa me ON me.puestoId = p.id
        WHERE mu.departamentoId = ${deptoId}
        GROUP BY z.municipioId
      `;
      const puestosMap = new Map<number, typeof puestosAgg[0]>(
        puestosAgg.map(r => [r.municipioId, r])
      );

      const result = municipios.map(m => {
        const agg = puestosMap.get(m.id);
        return {
          id: m.id,
          nombre: m.nombre,
          totalPuestos:     Number(agg?.totalPuestos)     || 0,
          totalEstimado:    Number(agg?.totalEstimado)    || 0,
          totalPosible:     potencialMap.get(m.id)        || 0,
          totalMesas:       Number(agg?.totalMesas)       || 0,
          totalVotosReales: Number(agg?.totalVotosReales) || 0,
        };
      });

      return NextResponse.json(result);
    }

    if (nivel === "puestos" && parentId) {
      const municipioId = parseInt(parentId);

      const puestos = await prisma.puesto.findMany({
        where: { zona: { municipioId } },
        include: { _count: { select: { mesas: true } }, zona: { select: { codigo: true } } },
        orderBy: { nombre: "asc" }
      });

      // Potencial = E14 viejo por puesto (una sola consulta SQL eficiente)
      const potencialRaw = await prisma.$queryRaw<Array<{ puestoId: number; total: number }>>`
        SELECT m.puestoId, CAST(COALESCE(SUM(v.totalVotos), 0) AS INTEGER) as total
        FROM Voto v
        JOIN Mesa m ON v.mesaId = m.id
        JOIN Puesto p ON m.puestoId = p.id
        JOIN Zona z ON p.zonaId = z.id
        WHERE z.municipioId = ${municipioId}
        GROUP BY m.puestoId
      `;
      const potencialMap = new Map<number, number>(
        potencialRaw.map(r => [r.puestoId, Number(r.total) || 0])
      );

      const result = puestos.map(p => ({
        id: p.id,
        nombre: p.nombre,
        zona: p.zona.codigo,
        mesas: p._count.mesas,
        estimado:     p.estimadoVotos  || 0,
        totalPosible: potencialMap.get(p.id) || 0,
        votosReales:  p.votosE14Real   || 0,
      }));

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  } catch (error) {
    console.error("Error fetching puestos data:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
