import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const skip = (page - 1) * limit;

  const where = search ? { nombre: { contains: search } } : undefined;

  const [data, total] = await Promise.all([
    prisma.partido.findMany({
      where,
      orderBy: { nombre: "asc" },
      skip,
      take: limit,
    }),
    prisma.partido.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
