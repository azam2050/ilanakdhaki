import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

/**
 * Admin auth via bearer token. The token is held in the ADMIN_TOKEN env var.
 * This is intentionally a simple shared-secret model for the small operator team —
 * upgrade to per-admin accounts when the operator team grows beyond ~3 people.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 16) {
    res.status(503).json({ error: "admin_not_configured" });
    return;
  }
  const header = req.headers["authorization"];
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing_token" });
    return;
  }
  const provided = header.slice(7).trim();
  // constant-time compare
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: "bad_token" });
    return;
  }
  next();
}
