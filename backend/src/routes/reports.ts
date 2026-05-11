import { Router, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireManager } from "../middleware/auth";
import { generateExcel } from "../services/exportService";
import { generateWeeklyPdf, generateMonthlyPdf } from "../services/pdfService";
import { prisma } from "../lib/prisma";

const router = Router();

const monthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const weekQuerySchema = z.object({
  week: z.string().regex(/^\d{4}-W\d{1,2}$/, "Geçersiz hafta formatı (örn: 2025-W18)"),
  userId: z.string().optional(),
});

// Proje x kullanıcı bazlı efor raporu — ?year=2025&month=5
router.get("/effort", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = monthQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const year = parsed.data.year ?? new Date().getFullYear();
    const month = parsed.data.month ?? new Date().getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-31`;

    const entries = await prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, status: "APPROVED" },
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, color: true } },
      },
    });

    const effortMap: Record<string, Record<string, number>> = {};
    for (const e of entries) {
      const [sh, sm] = e.startTime.split(":").map(Number);
      const [eh, em] = e.endTime.split(":").map(Number);
      const minutes = (eh * 60 + em) - (sh * 60 + sm);
      const projKey = `${e.project.id}|${e.project.name}|${e.project.color}`;
      const userKey = `${e.user.id}|${e.user.name}`;
      if (!effortMap[projKey]) effortMap[projKey] = {};
      effortMap[projKey][userKey] = (effortMap[projKey][userKey] || 0) + minutes;
    }

    const result = Object.entries(effortMap).map(([proj, users]) => {
      const [id, name, color] = proj.split("|");
      return {
        project: { id, name, color },
        users: Object.entries(users).map(([u, minutes]) => {
          const [uid, uname] = u.split("|");
          return { id: uid, name: uname, hours: Math.round((minutes / 60) * 10) / 10 };
        }),
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Çalışan özet — aylık toplam saat
router.get("/summary", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = monthQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const year = parsed.data.year ?? new Date().getFullYear();
    const month = parsed.data.month ?? new Date().getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-31`;

    const users = await prisma.user.findMany({
      where: { isActive: true, role: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        entries: {
          where: { date: { gte: start, lte: end }, status: "APPROVED" },
          select: { startTime: true, endTime: true },
        },
      },
    });

    const summary = users.map((u) => {
      const totalMin = u.entries.reduce((acc, e) => {
        const [sh, sm] = e.startTime.split(":").map(Number);
        const [eh, em] = e.endTime.split(":").map(Number);
        return acc + (eh * 60 + em) - (sh * 60 + sm);
      }, 0);
      return { id: u.id, name: u.name, hours: Math.round((totalMin / 60) * 10) / 10 };
    });

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Excel export — ?week=2025-W18
router.get("/export/excel", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = weekQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { week, userId } = parsed.data;
    const buffer = await generateExcel(week, prisma, userId || null);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="timesheet-${week}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// PDF haftalık export — ?week=2025-W18&userId=...
router.get("/export/pdf/weekly", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = weekQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { week, userId } = parsed.data;
    const buffer = await generateWeeklyPdf(week, prisma, userId || null);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="timesheet-haftalik-${week}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// PDF aylık export — ?year=2025&month=5&userId=...
router.get("/export/pdf/monthly", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const schema = monthQuerySchema.extend({ userId: z.string().optional() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const year = parsed.data.year ?? new Date().getFullYear();
    const month = parsed.data.month ?? new Date().getMonth() + 1;
    const buffer = await generateMonthlyPdf(year, month, prisma, parsed.data.userId || null);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="timesheet-aylik-${year}-${String(month).padStart(2, "0")}.pdf"`
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ── Advanced Report Builder ───────────────────────────────────────────────────

const advancedQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih formatı (YYYY-MM-DD)"),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih formatı (YYYY-MM-DD)"),
  userIds:    z.string().optional(),    // csv
  projectIds: z.string().optional(),   // csv
  status:     z.string().optional(),   // csv: DRAFT,PENDING,APPROVED,REJECTED
  groupBy:    z.enum(["project", "user", "day", "week", "month"]).default("project"),
  type:       z.enum(["summary", "comparison", "absence"]).default("summary"),
});

function calcMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function isoWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const tmp = new Date(d.getTime());
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getGroupKey(entry: any, groupBy: string): string {
  switch (groupBy) {
    case "project": return entry.project.id;
    case "user":    return entry.userId;
    case "day":     return entry.date;
    case "week":    return isoWeekLabel(entry.date);
    case "month":   return entry.date.slice(0, 7);
    default:        return entry.project.id;
  }
}

function getGroupLabel(entry: any, groupBy: string): string {
  switch (groupBy) {
    case "project": return entry.project.name;
    case "user":    return entry.user.name;
    case "day":     return entry.date;
    case "week":    return isoWeekLabel(entry.date);
    case "month":   return entry.date.slice(0, 7);
    default:        return entry.project.name;
  }
}

function aggregateEntries(entries: any[], groupBy: string) {
  const map: Record<string, { key: string; label: string; color?: string; minutes: number; entryCount: number }> = {};
  for (const e of entries) {
    const key = getGroupKey(e, groupBy);
    const label = getGroupLabel(e, groupBy);
    const color = groupBy === "project" ? e.project.color : undefined;
    if (!map[key]) map[key] = { key, label, color, minutes: 0, entryCount: 0 };
    map[key].minutes += calcMinutes(e.startTime, e.endTime);
    map[key].entryCount += 1;
  }
  return Object.values(map).map((g) => ({
    key: g.key,
    label: g.label,
    color: g.color,
    hours: Math.round((g.minutes / 60) * 10) / 10,
    entryCount: g.entryCount,
  }));
}

router.get("/advanced", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const parsed = advancedQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { startDate, endDate, userIds, projectIds, status, groupBy, type } = parsed.data;

    const userIdList    = userIds    ? userIds.split(",").filter(Boolean)    : [];
    const projectIdList = projectIds ? projectIds.split(",").filter(Boolean) : [];
    const statusList    = status     ? status.split(",").filter(Boolean)     : [];

    const where: any = {
      date: { gte: startDate, lte: endDate },
    };
    if (userIdList.length)    where.userId    = { in: userIdList };
    if (projectIdList.length) where.projectId = { in: projectIdList };
    if (statusList.length)    where.status    = { in: statusList };

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user:    { select: { id: true, name: true } },
        project: { select: { id: true, name: true, color: true } },
        approval: { include: { manager: { select: { id: true, name: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const totalMinutes = entries.reduce((acc, e) => acc + calcMinutes(e.startTime, e.endTime), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    // Business days between startDate and endDate
    let businessDays = 0;
    const cur = new Date(startDate + "T00:00:00");
    const endD = new Date(endDate + "T00:00:00");
    while (cur <= endD) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) businessDays++;
      cur.setDate(cur.getDate() + 1);
    }
    const avgDailyHours = businessDays > 0 ? Math.round((totalHours / businessDays) * 10) / 10 : 0;

    // Top user / project by hours
    const userMap: Record<string, number> = {};
    const projMap: Record<string, { name: string; minutes: number }> = {};
    for (const e of entries) {
      const min = calcMinutes(e.startTime, e.endTime);
      userMap[e.user.name] = (userMap[e.user.name] || 0) + min;
      if (!projMap[e.project.id]) projMap[e.project.id] = { name: e.project.name, minutes: 0 };
      projMap[e.project.id].minutes += min;
    }
    const topUser    = Object.entries(userMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topProject = Object.values(projMap).sort((a, b) => b.minutes - a.minutes)[0]?.name ?? null;

    const grouped = aggregateEntries(entries, groupBy);

    // Comparison period
    let comparison = null;
    if (type === "comparison") {
      const start = new Date(startDate + "T00:00:00");
      const end   = new Date(endDate   + "T00:00:00");
      const diffMs = end.getTime() - start.getTime();
      const prevEnd   = new Date(start.getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - diffMs);
      const prevStartStr = prevStart.toISOString().slice(0, 10);
      const prevEndStr   = prevEnd.toISOString().slice(0, 10);

      const prevWhere: any = { date: { gte: prevStartStr, lte: prevEndStr } };
      if (userIdList.length)    prevWhere.userId    = { in: userIdList };
      if (projectIdList.length) prevWhere.projectId = { in: projectIdList };
      if (statusList.length)    prevWhere.status    = { in: statusList };

      const prevEntries = await prisma.timeEntry.findMany({
        where: prevWhere,
        include: {
          user:    { select: { id: true, name: true } },
          project: { select: { id: true, name: true, color: true } },
          approval: { include: { manager: { select: { id: true, name: true } } } },
        },
      });

      const prevMinutes = prevEntries.reduce((acc, e) => acc + calcMinutes(e.startTime, e.endTime), 0);
      const prevHours   = Math.round((prevMinutes / 60) * 10) / 10;
      const diff    = Math.round((totalHours - prevHours) * 10) / 10;
      const diffPct = prevHours > 0 ? Math.round((diff / prevHours) * 1000) / 10 : 0;

      comparison = {
        period: { start: prevStartStr, end: prevEndStr },
        totalHours: prevHours,
        grouped: aggregateEntries(prevEntries, groupBy),
        diff,
        diffPct,
      };
    }

    // Absence data
    let absenceData = null;
    if (type === "absence") {
      // Get all users matching filter
      const userWhere: any = { isActive: true };
      if (userIdList.length) userWhere.id = { in: userIdList };
      const users = await prisma.user.findMany({
        where: userWhere,
        select: { id: true, name: true },
      });

      // Get approved leave requests in period
      const leaveWhere: any = { date: { gte: startDate, lte: endDate }, status: "APPROVED" };
      if (userIdList.length) leaveWhere.userId = { in: userIdList };
      const leaves = await prisma.leaveRequest.findMany({ where: leaveWhere });

      absenceData = users.map((u) => {
        // Days this user worked (has at least one entry)
        const userEntries = entries.filter((e) => e.userId === u.id);
        const workedDates = new Set(userEntries.map((e) => e.date));
        const daysWorked  = workedDates.size;
        const leaveDays   = leaves.filter((l) => l.userId === u.id).length;
        const missedDays  = Math.max(0, businessDays - daysWorked - leaveDays);
        const attendanceRate = businessDays > 0
          ? Math.round(((daysWorked + leaveDays) / businessDays) * 1000) / 10
          : 0;

        // Max streak: consecutive worked days
        let maxStreak = 0, streak = 0;
        const sortedDates = [...workedDates].sort();
        for (let i = 0; i < sortedDates.length; i++) {
          if (i === 0) { streak = 1; }
          else {
            const prev = new Date(sortedDates[i - 1] + "T00:00:00");
            const curr = new Date(sortedDates[i]     + "T00:00:00");
            const diffDay = (curr.getTime() - prev.getTime()) / 86400000;
            streak = diffDay === 1 ? streak + 1 : 1;
          }
          if (streak > maxStreak) maxStreak = streak;
        }

        return { userId: u.id, name: u.name, businessDays, daysWorked, leaveDays, missedDays, attendanceRate, maxStreak };
      });
    }

    res.json({
      period: { start: startDate, end: endDate },
      entries: entries.map((e) => ({
        id: e.id,
        userId: e.userId,
        userName: e.user.name,
        projectId: e.project.id,
        projectName: e.project.name,
        projectColor: e.project.color,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        note: e.note,
        status: e.status,
        approval: e.approval ? { action: e.approval.action, note: e.approval.note, managerName: e.approval.manager?.name } : null,
      })),
      summary: { totalHours, avgDailyHours, topUser, topProject, entryCount: entries.length },
      grouped,
      comparison,
      absenceData,
    });
  } catch (err) {
    next(err);
  }
});

// CSV export — ?startDate=&endDate=&userIds=&projectIds=&status=
router.get("/export/csv", requireAuth, requireManager, async (req, res, next: NextFunction) => {
  try {
    const schema = z.object({
      startDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      userIds:    z.string().optional(),
      projectIds: z.string().optional(),
      status:     z.string().optional(),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { startDate, endDate, userIds, projectIds, status } = parsed.data;
    const userIdList    = userIds    ? userIds.split(",").filter(Boolean)    : [];
    const projectIdList = projectIds ? projectIds.split(",").filter(Boolean) : [];
    const statusList    = status     ? status.split(",").filter(Boolean)     : [];

    const where: any = { date: { gte: startDate, lte: endDate } };
    if (userIdList.length)    where.userId    = { in: userIdList };
    if (projectIdList.length) where.projectId = { in: projectIdList };
    if (statusList.length)    where.status    = { in: statusList };

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user:    { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        approval: { include: { manager: { select: { name: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    function q(s: string): string {
      return `"${String(s ?? "").replace(/"/g, '""')}"`;
    }

    function statusLabel(s: string): string {
      switch (s) {
        case "APPROVED": return "Onaylı";
        case "PENDING":  return "Bekliyor";
        case "REJECTED": return "Reddedildi";
        case "DRAFT":    return "Taslak";
        default:         return s;
      }
    }

    const headers = ["Çalışan", "Tarih", "Proje", "Başlangıç", "Bitiş", "Süre(sa)", "Not", "Durum", "Onaylayan"];
    const rows = entries.map((e) => {
      const minutes = calcMinutes(e.startTime, e.endTime);
      const hours   = Math.round((minutes / 60) * 100) / 100;
      return [
        q(e.user.name),
        q(e.date),
        q(e.project.name),
        q(e.startTime),
        q(e.endTime),
        q(String(hours)),
        q(e.note || ""),
        q(statusLabel(e.status)),
        q(e.approval?.manager?.name || ""),
      ].join(",");
    });

    const BOM = "﻿";
    const csv = BOM + [headers.map(q).join(","), ...rows].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="timesheet-${startDate}-${endDate}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// Personal report — GET /reports/personal?year=&month=
router.get("/personal", requireAuth, async (req, res, next: NextFunction) => {
  try {
    const schema = z.object({
      year:  z.coerce.number().int().min(2000).max(2100).optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const userId = (req as any).user.id;
    const year  = parsed.data.year  ?? new Date().getFullYear();
    const month = parsed.data.month ?? new Date().getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end   = `${year}-${String(month).padStart(2, "0")}-31`;

    const [user, entries, gamification, badges] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { weeklyTargetHours: true } }),
      prisma.timeEntry.findMany({
        where: { userId, date: { gte: start, lte: end } },
        include: { project: { select: { id: true, name: true, color: true } } },
      }),
      prisma.gamification.findUnique({ where: { userId } }),
      prisma.badge.findMany({ where: { userId }, orderBy: { earnedAt: "asc" } }),
    ]);

    const allMinutes      = entries.reduce((acc, e) => acc + calcMinutes(e.startTime, e.endTime), 0);
    const approvedMinutes = entries.filter((e) => e.status === "APPROVED")
                                   .reduce((acc, e) => acc + calcMinutes(e.startTime, e.endTime), 0);
    const monthlyHours   = Math.round((allMinutes      / 60) * 10) / 10;
    const approvedHours  = Math.round((approvedMinutes / 60) * 10) / 10;
    const targetHours    = Math.round((user?.weeklyTargetHours ?? 40) * 4 * 10) / 10;
    const completionPct  = targetHours > 0 ? Math.round((approvedHours / targetHours) * 1000) / 10 : 0;

    // Project distribution (approved entries only)
    const projMap: Record<string, { id: string; name: string; color: string; minutes: number }> = {};
    for (const e of entries.filter((e) => e.status === "APPROVED")) {
      if (!projMap[e.project.id]) {
        projMap[e.project.id] = { id: e.project.id, name: e.project.name, color: e.project.color, minutes: 0 };
      }
      projMap[e.project.id].minutes += calcMinutes(e.startTime, e.endTime);
    }
    const projectDistribution = Object.values(projMap)
      .sort((a, b) => b.minutes - a.minutes)
      .map((p) => ({
        id: p.id, name: p.name, color: p.color,
        hours: Math.round((p.minutes / 60) * 10) / 10,
        percentage: approvedMinutes > 0 ? Math.round((p.minutes / approvedMinutes) * 1000) / 10 : 0,
      }));

    // Weekly trend: last 4 weeks approved hours
    const weeklyTrend: { weekStart: string; hours: number }[] = [];
    const now = new Date();
    for (let w = 3; w >= 0; w--) {
      const monday = new Date(now);
      const day = monday.getDay();
      const diff = (day === 0 ? -6 : 1 - day) - w * 7;
      monday.setDate(monday.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      const ws = monday.toISOString().slice(0, 10);
      const we = sunday.toISOString().slice(0, 10);

      const weekEntries = await prisma.timeEntry.findMany({
        where: { userId, status: "APPROVED", date: { gte: ws, lte: we } },
        select: { startTime: true, endTime: true },
      });
      const wHours = weekEntries.reduce((acc, e) => acc + calcMinutes(e.startTime, e.endTime), 0);
      weeklyTrend.push({ weekStart: ws, hours: Math.round((wHours / 60) * 10) / 10 });
    }

    res.json({
      monthlyHours,
      approvedHours,
      targetHours,
      completionPercent: completionPct,
      projectDistribution,
      weeklyTrend,
      gamification: gamification
        ? { xpTotal: gamification.xpTotal, streakDays: gamification.streakDays }
        : { xpTotal: 0, streakDays: 0 },
      badges: badges.map((b) => ({ type: b.type, earnedAt: b.earnedAt.toISOString() })),
    });
  } catch (err) {
    next(err);
  }
});

export { router as reportsRouter };

