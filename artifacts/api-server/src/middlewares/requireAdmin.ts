import type { Request, Response, NextFunction } from "express";
import { resolveAdminContext, type AdminContext, type AdminRole } from "../lib/adminAuth";

declare global {
  namespace Express {
    interface Request {
      adminContext?: AdminContext;
    }
  }
}

async function authenticate(req: Request): Promise<AdminContext | null> {
  const header = req.headers["authorization"];
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const provided = header.slice(7).trim();
  if (!provided) return null;
  try {
    return await resolveAdminContext(provided);
  } catch {
    return null;
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ctx = await authenticate(req);
  if (!ctx) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  req.adminContext = ctx;
  next();
}

export function requireAdminRole(role: AdminRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ctx = await authenticate(req);
    if (!ctx) { res.status(401).json({ error: "unauthorized" }); return; }
    if (role === "super" && ctx.role !== "super") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    req.adminContext = ctx;
    next();
  };
}
