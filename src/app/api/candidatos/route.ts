import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const partidoId = searchParams.get("partidoId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (search) where.nombre = { contains: search };
  if (partidoId) where.partidoId = parseInt(partidoId);

  const [data, total] = await Promise.all([
    prisma.candidato.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { partido: { select: { id: true, nombre: true } } },
      orderBy: { nombre: "asc" },
      skip,
      take: limit,
    }),
    prisma.candidato.count({
      where: Object.keys(where).length > 0 ? where : undefined,
    }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
