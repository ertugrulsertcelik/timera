import { PrismaClient } from "@prisma/client";

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Verilen kullanici + tarih + saat araliginda cakisma var mi?
 * excludeId: guncelleme sirasinda kendi girisini haric tut
 */
export async function checkOverlap(
  userId: string,
  date: string,
  startTime: string,
  endTime: string,
  prisma: PrismaClient,
  excludeId?: string
): Promise<boolean> {
  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      date,
      status: { not: "REJECTED" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { startTime: true, endTime: true },
  });

  const newStart = toMin(startTime);
  const newEnd = toMin(endTime);

  return entries.some((e) => {
    const eStart = toMin(e.startTime);
    const eEnd = toMin(e.endTime);
    return newStart < eEnd && newEnd > eStart;
  });
}
