import { Router, NextFunction } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/me", requireAuth, async (req: AuthRequest, res, next: NextFunction) => {
  try {
    const data = await prisma.gamification.findUnique({
      where: { userId: req.user!.id },
      include: { user: { select: { name: true } } },
    });
    const badges = await prisma.badge.findMany({ where: { userId: req.user!.id } });
    res.json({ ...data, badges });
  } catch (err) {
    next(err);
  }
});

router.get("/leaderboard", requireAuth, async (_req, res, next: NextFunction) => {
  try {
    const data = await prisma.gamification.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { xpTotal: "desc" },
      take: 20,
    });
    res.json(
      data.map((d, i) => ({
        rank: i + 1,
        name: d.user.name,
        xp: d.xpTotal,
        streak: d.streakDays,
      }))
    );
  } catch (err) {
    next(err);
  }
});

export { router as gamificationRouter };
