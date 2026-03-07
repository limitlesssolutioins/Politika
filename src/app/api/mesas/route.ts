import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const departamentoId = searchParams.get("departamentoId");
  const municipioId = searchParams.get("municipioId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

  const where: any = {};
  
  if (search) {
    const num = parseInt(search);
    if (!isNaN(num) && search.trim() === String(num)) {
      where.numero = num;
    } else {
      where.puesto = { nombre: { contains: search } };
    }
  }

  if (municipioId) {
    where.puesto = {
      ...where.puesto,
      zona: { municipioId: parseInt(municipioId) },
    };
  } else if (departamentoId) {
    where.puesto = {
      ...where.puesto,
      zona: { municipio: { departamentoId: parseInt(departamentoId) } },
    };
  }

  const mesas = await prisma.mesa.findMany({
    where,
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
      _count: {
        select: { votos: true },
      },
    },
    orderBy: { potencialElectoral: "desc" },
    take: limit,
  });

  // Calculate total votes for each mesa efficiently
  // Note: For a real app with large data, doing _sum would be better,
  // but we'll do an aggregate per mesa if _count.votos > 0
  
  const mesaIds = mesas.map(m => m.id);
  let votosMap = new Map<number, number>();
  
  if (mesaIds.length > 0) {
    const mesaVotos = await prisma.voto.groupBy({
      by: ["mesaId"],
      where: { mesaId: { in: mesaIds } },
      _sum: { totalVotos: true },
    });
    votosMap = new Map(mesaVotos.map((v) => [v.mesaId, v._sum.totalVotos ?? 0]));
  }

  const result = mesas.map((m) => ({
    id: m.id,
    numero: m.numero,
    potencialElectoral: m.potencialElectoral,
    estimadoVotos: m.estimadoVotos,
    puesto: m.puesto.nombre,
    zona: m.puesto.zona.codigo,
    municipio: m.puesto.zona.municipio.nombre,
    departamento: m.puesto.zona.municipio.departamento.nombre,
    totalVotos: votosMap.get(m.id) ?? 0,
  }));

  return NextResponse.json({ data: result });
}
