import crypto from "node:crypto";
import { db, adminUsersTable, adminSessionsTable, adminActivityTable } from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";

export type AdminRole = "super" | "employee";

export interface AdminContext {
  source: "env" | "session";
  role: AdminRole;
  userId?: string;
  email?: string;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export function hashPassword(plain: string, salt?: string): string {
  const s = salt ?? crypto.randomBytes(16).toString("hex");
  const buf = crypto.scryptSync(plain, s, 64);
  return `scrypt$${s}$${buf.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hex] = parts;
  const buf = crypto.scryptSync(plain, salt, 64);
  const a = Buffer.from(hex, "hex");
  return a.length === buf.length && crypto.timingSafeEqual(a, buf);
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(adminUserId: string, role: AdminRole, ttlMs = SESSION_TTL_MS): Promise<string> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.insert(adminSessionsTable).values({ token, adminUserId, role, expiresAt });
  return token;
}

export async function resolveAdminContext(bearer: string): Promise<AdminContext | null> {
  const envToken = process.env.ADMIN_TOKEN;
  if (envToken && envToken.length >= 16) {
    const a = Buffer.from(bearer);
    const b = Buffer.from(envToken);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { source: "env", role: "super" };
    }
  }
  const rows = await db
    .select()
    .from(adminSessionsTable)
    .where(and(eq(adminSessionsTable.token, bearer), gt(adminSessionsTable.expiresAt, new Date())))
    .limit(1);
  if (rows.length === 0) return null;
  const s = rows[0];
  const u = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, s.adminUserId)).limit(1);
  if (u.length === 0) return null;
  return { source: "session", role: s.role as AdminRole, userId: s.adminUserId, email: u[0].email };
}

export async function logActivity(
  ctx: AdminContext | null,
  action: string,
  opts: { targetType?: string; targetId?: string; summary?: string } = {},
): Promise<void> {
  await db.insert(adminActivityTable).values({
    adminUserId: ctx?.userId ?? null,
    actorEmail: ctx?.email ?? (ctx?.source === "env" ? "super@platform" : null),
    action,
    targetType: opts.targetType ?? null,
    targetId: opts.targetId ?? null,
    summary: opts.summary ?? null,
  });
}

export async function listRecentActivity(limit = 20): Promise<Array<{
  id: string; actorEmail: string | null; action: string; targetType: string | null;
  targetId: string | null; summary: string | null; occurredAt: string;
}>> {
  const rows = await db
    .select()
    .from(adminActivityTable)
    .orderBy(desc(adminActivityTable.occurredAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    actorEmail: r.actorEmail,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    summary: r.summary,
    occurredAt: r.occurredAt.toISOString(),
  }));
}
