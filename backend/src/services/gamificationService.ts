import { PrismaClient, BadgeType } from "@prisma/client";

const XP_PER_HALF_HOUR = 10;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export async function awardXP(
  userId: string,
  startTime: string,
  endTime: string,
  date: string,
  prisma: PrismaClient
) {
  const durationMin = toMin(endTime) - toMin(startTime);
  const xpEarned = Math.floor(durationMin / 30) * XP_PER_HALF_HOUR;

  const g = await prisma.gamification.upsert({
    where: { userId },
    create: { userId, xpTotal: 0, streakDays: 0 },
    update: {},
  });

  // Streak hesapla
  let newStreak = g.streakDays;
  if (g.lastEntryDate) {
    const diffDays = Math.round(
      (new Date(date).getTime() - new Date(g.lastEntryDate).getTime()) / 86400000
    );
    if (diffDays === 1) newStreak += 1;
    else if (diffDays > 1) newStreak = 1;
    // diffDays === 0: ayni gun tekrar giris, streak degismez
  } else {
    newStreak = 1;
  }

  // Streak bonuslari
  let bonusXP = 0;
  if (newStreak === 5) bonusXP = 50;
  else if (newStreak === 10) bonusXP = 100;
  else if (newStreak === 30) bonusXP = 300;

  await prisma.gamification.update({
    where: { userId },
    data: {
      xpTotal: { increment: xpEarned + bonusXP },
      streakDays: newStreak,
      lastEntryDate: date,
    },
  });

  // Rozet kontrolu
  await checkBadges(userId, newStreak, startTime, prisma);
}

async function checkBadges(
  userId: string,
  streak: number,
  startTime: string,
  prisma: PrismaClient
) {
  const badges: BadgeType[] = [];
  if (streak >= 5) badges.push(BadgeType.STREAK_5);
  if (streak >= 10) badges.push(BadgeType.STREAK_10);
  if (streak >= 30) badges.push(BadgeType.STREAK_30);

  // Erken kus: 09:00 oncesi giris
  const [h] = startTime.split(":").map(Number);
  if (h < 9) badges.push(BadgeType.EARLY_BIRD);

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { userId_type: { userId, type: badge } },
      update: {},
      create: { userId, type: badge },
    });
  }
}
