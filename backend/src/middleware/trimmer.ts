import { Request, Response, NextFunction } from "express";

function trimStrings(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(trimStrings);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as object)) {
      result[key] = trimStrings((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

/** Tüm string input'larda trim() uygular */
export function trimmer(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = trimStrings(req.body);
  }
  next();
}
