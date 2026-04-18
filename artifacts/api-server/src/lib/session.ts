import type { Request, Response } from "express";
import { eq, lt } from "drizzle-orm";
import { db, sessionsTable, merchantsTable } from "@workspace/db";
import type { Merchant } from "@workspace/db";
import { randomToken } from "./crypto";

const SESSION_COOKIE = "sa_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function createSession(merchantId: string): Promise<string> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ token, merchantId, expiresAt });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export async function loadMerchantBySessionToken(
  token: string,
): Promise<Merchant | null> {
  const [row] = await db
    .select({
      session: sessionsTable,
      merchant: merchantsTable,
    })
    .from(sessionsTable)
    .innerJoin(
      merchantsTable,
      eq(merchantsTable.id, sessionsTable.merchantId),
    )
    .where(eq(sessionsTable.token, token))
    .limit(1);
  if (!row) return null;
  if (row.session.expiresAt.getTime() <= Date.now()) {
    await destroySession(token);
    return null;
  }
  return row.merchant;
}

export function setSessionCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function readSessionCookie(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  return cookies?.[SESSION_COOKIE] ?? null;
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
}
