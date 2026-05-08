export type Role = "EMPLOYEE" | "MANAGER";
export type EntryStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
  isActive: boolean;
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  project: Project;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
  status: EntryStatus;
  approval?: { note?: string | null; action: string } | null;
}

export interface Gamification {
  xpTotal: number;
  streakDays: number;
  lastEntryDate?: string;
  badges: { type: string; earnedAt: string }[];
}

export type LeaveType = "ANNUAL" | "SICK" | "UNPAID" | "PUBLIC_HOLIDAY";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LeaveRequest {
  id: string;
  userId: string;
  date: string;
  type: LeaveType;
  note?: string | null;
  status: LeaveStatus;
  managerId?: string | null;
  managerNote?: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  manager?: { id: string; name: string } | null;
}

export interface LeaveBalance {
  annualRemaining: number;
  annualUsed: number;
  sickUsed: number;
  unpaidUsed: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  streak: number;
}
