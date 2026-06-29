import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Restaurant table CRUD (tenant-scoped). */

export async function listTables(restaurantId: string) {
  return prisma.restaurantTable.findMany({
    where: { restaurantId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export async function listActiveTables(restaurantId: string) {
  return prisma.restaurantTable.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { capacity: "asc" },
  });
}

export interface TableInput {
  name: string;
  capacity: number;
  location?: string | null;
  isActive?: boolean;
  position?: number;
}

export async function createTable(restaurantId: string, input: TableInput) {
  try {
    return await prisma.restaurantTable.create({
      data: {
        restaurantId,
        name: input.name,
        capacity: input.capacity,
        location: input.location || null,
        isActive: input.isActive ?? true,
        position: input.position ?? 0,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("A table with that name already exists");
    }
    throw e;
  }
}

export async function updateTable(restaurantId: string, id: string, input: Partial<TableInput>) {
  const existing = await prisma.restaurantTable.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;
  try {
    return await prisma.restaurantTable.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? existing.name,
        capacity: input.capacity ?? existing.capacity,
        location: input.location !== undefined ? input.location || null : existing.location,
        isActive: input.isActive ?? existing.isActive,
        position: input.position ?? existing.position,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("A table with that name already exists");
    }
    throw e;
  }
}

export async function deleteTable(restaurantId: string, id: string) {
  const res = await prisma.restaurantTable.deleteMany({ where: { id, restaurantId } });
  return res.count > 0;
}
