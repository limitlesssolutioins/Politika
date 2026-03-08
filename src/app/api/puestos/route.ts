import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nivel = searchParams.get("nivel") || "departamentos";
  const parentId = searchParams.get("parentId"); // deptoId o muniId

  try {
    if (nivel === "departamentos") {
      // Get departments and summarize puestos and estimated votes
      const deptos = await prisma.departamento.findMany({
        orderBy: { nombre: "asc" }
      });
      
      const puestos = await prisma.puesto.findMany({
        include: {
          zona: { select: { municipio: { select: { departamentoId: true } } } },
          _count: { select: { mesas: true } }
        }
      });

      const mesasAgg = await prisma.mesa.groupBy({
        by: ['puestoId'],
        _sum: { potencialElectoral: true }
      });
      const mesaPotencialMap = new Map(mesasAgg.map(m => [m.puestoId, m._sum.potencialElectoral || 0]));

      const deptoStats = new Map<number, { totalPuestos: number, totalEstimado: number, totalPosible: number, mesas: number }>();
      
      for (const p of puestos) {
        const dId = p.zona.municipio.departamentoId;
        const current = deptoStats.get(dId) || { totalPuestos: 0, totalEstimado: 0, totalPosible: 0, mesas: 0 };
        current.totalPuestos += 1;
        current.totalEstimado += (p.estimadoVotos || 0);
        current.totalPosible += (p.potencialElectoral || mesaPotencialMap.get(p.id) || 0);
        current.mesas += p._count.mesas;
        deptoStats.set(dId, current);
      }

      const result = deptos.map(d => ({
        id: d.id,
        nombre: d.nombre,
        totalPuestos: deptoStats.get(d.id)?.totalPuestos || 0,
        totalEstimado: deptoStats.get(d.id)?.totalEstimado || 0,
        totalPosible: deptoStats.get(d.id)?.totalPosible || 0,
        totalMesas: deptoStats.get(d.id)?.mesas || 0,
      }));

      return NextResponse.json(result);
    }

    if (nivel === "municipios" && parentId) {
      const municipios = await prisma.municipio.findMany({
        where: { departamentoId: parseInt(parentId) },
        orderBy: { nombre: "asc" }
      });

      const puestos = await prisma.puesto.findMany({
        where: { zona: { municipioId: { in: municipios.map(m => m.id) } } },
        include: { zona: { select: { municipioId: true } }, _count: { select: { mesas: true } } }
      });

      const puestoIds = puestos.map(p => p.id);
      const mesasAgg: { puestoId: number; _sum: { potencialElectoral: number | null } }[] = [];
      const CHUNK_SIZE = 900;
      for (let i = 0; i < puestoIds.length; i += CHUNK_SIZE) {
        const chunk = puestoIds.slice(i, i + CHUNK_SIZE);
        const batch = await prisma.mesa.groupBy({
          by: ['puestoId'],
          where: { puestoId: { in: chunk } },
          _sum: { potencialElectoral: true }
        });
        mesasAgg.push(...batch);
      }
      const mesaPotencialMap = new Map(mesasAgg.map(m => [m.puestoId, m._sum.potencialElectoral || 0]));

      const muniStats = new Map<number, { totalPuestos: number, totalEstimado: number, totalPosible: number, mesas: number }>();
      
      for (const p of puestos) {
        const mId = p.zona.municipioId;
        const current = muniStats.get(mId) || { totalPuestos: 0, totalEstimado: 0, totalPosible: 0, mesas: 0 };
        current.totalPuestos += 1;
        current.totalEstimado += (p.estimadoVotos || 0);
        current.totalPosible += (p.potencialElectoral || mesaPotencialMap.get(p.id) || 0);
        current.mesas += p._count.mesas;
        muniStats.set(mId, current);
      }

      const result = municipios.map(m => ({
        id: m.id,
        nombre: m.nombre,
        totalPuestos: muniStats.get(m.id)?.totalPuestos || 0,
        totalEstimado: muniStats.get(m.id)?.totalEstimado || 0,
        totalPosible: muniStats.get(m.id)?.totalPosible || 0,
        totalMesas: muniStats.get(m.id)?.mesas || 0,
      }));

      return NextResponse.json(result);
    }

    if (nivel === "puestos" && parentId) {
      // parentId is municipioId
      const puestos = await prisma.puesto.findMany({
        where: { zona: { municipioId: parseInt(parentId) } },
        include: { _count: { select: { mesas: true } }, zona: { select: { codigo: true } } },
        orderBy: { nombre: "asc" }
      });

      // Get real votes to compare
      // For each puesto, calculate total actual votes across all its mesas
      const puestoIds = puestos.map(p => p.id);
      
      const mesasAgg: { puestoId: number; _sum: { potencialElectoral: number | null } }[] = [];
      const CHUNK_SIZE = 900;
      for (let i = 0; i < puestoIds.length; i += CHUNK_SIZE) {
        const chunk = puestoIds.slice(i, i + CHUNK_SIZE);
        const batch = await prisma.mesa.groupBy({
          by: ['puestoId'],
          where: { puestoId: { in: chunk } },
          _sum: { potencialElectoral: true }
        });
        mesasAgg.push(...batch);
      }
      const mesaPotencialMap = new Map(mesasAgg.map(m => [m.puestoId, m._sum.potencialElectoral || 0]));
      
      const mesaPuestoMap = new Map<number, number>();
      
      // Fetch in chunks to avoid SQLite "too many SQL variables" (limit 999)
      const mesasObj = [];
      for (let i = 0; i < puestoIds.length; i += CHUNK_SIZE) {
        const chunk = puestoIds.slice(i, i + CHUNK_SIZE);
        const batch = await prisma.mesa.findMany({
          where: { puestoId: { in: chunk } },
          select: { id: true, puestoId: true }
        });
        mesasObj.push(...batch);
      }
      
      const mesaIds = mesasObj.map(m => m.id);
      for (const m of mesasObj) mesaPuestoMap.set(m.id, m.puestoId);

      const realVotes: { mesaId: number; _sum: { totalVotos: number | null } }[] = [];
      if (mesaIds.length > 0) {
        for (let i = 0; i < mesaIds.length; i += CHUNK_SIZE) {
          const chunk = mesaIds.slice(i, i + CHUNK_SIZE);
          const batch = await prisma.voto.groupBy({
            by: ["mesaId"],
            where: { mesaId: { in: chunk } },
            _sum: { totalVotos: true }
          });
          realVotes.push(...batch);
        }
      }

      const puestoRealVotes = new Map<number, number>();
      for (const rv of realVotes) {
        const pId = mesaPuestoMap.get(rv.mesaId);
        if (pId) {
          const current = puestoRealVotes.get(pId) || 0;
          puestoRealVotes.set(pId, current + (rv._sum.totalVotos || 0));
        }
      }

      const result = puestos.map(p => ({
        id: p.id,
        nombre: p.nombre,
        zona: p.zona.codigo,
        mesas: p._count.mesas,
        estimado: p.estimadoVotos || 0,
        totalPosible: p.potencialElectoral || mesaPotencialMap.get(p.id) || 0,
        votosReales: puestoRealVotes.get(p.id) || 0
      }));

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  } catch (error) {
    console.error("Error fetching puestos data:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
