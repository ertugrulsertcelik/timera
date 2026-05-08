import { PrismaClient } from "@prisma/client";

function buildUrl() {
  const base = process.env.DATABASE_URL!;
  try {
    const url = new URL(base);
    url.searchParams.set("connection_limit", "10");
    url.searchParams.set("pool_timeout", "10");
    return url.toString();
  } catch {
    // URL parse edilemezse olduğu gibi kullan
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}connection_limit=10&pool_timeout=10`;
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: { db: { url: buildUrl() } },
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
