import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";
import {
  createSession,
  hashPassword,
  verifyPassword,
  resolveAdminContext,
  logActivity,
} from "../lib/adminAuth";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const loginSchema = z.object({
  password: z.string().min(1),
  email: z.string().email().optional(),
});

router.post("/admin/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "bad_input" }); return; }
  const { email, password } = parsed.data;

  // Path A: super admin password (no email) — first try DB super, then env token fallback
  if (!email) {
    const supers = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.role, "super"))
      .limit(1);
    if (supers.length > 0 && supers[0].passwordHash) {
      if (verifyPassword(password, supers[0].passwordHash)) {
        const token = await createSession(supers[0].id, "super");
        await db.update(adminUsersTable).set({ lastLoginAt: new Date() }).where(eq(adminUsersTable.id, supers[0].id));
        await logActivity({ source: "session", role: "super", userId: supers[0].id, email: supers[0].email }, "login");
        res.json({ token, role: "super", email: supers[0].email });
        return;
      }
      res.status(401).json({ error: "bad_credentials" });
      return;
    }
    // No DB super yet — accept env token as bootstrap super
    const ctx = await resolveAdminContext(password);
    if (ctx?.role === "super") {
      res.json({ token: password, role: "super", email: null, bootstrap: true });
      return;
    }
    res.status(401).json({ error: "bad_credentials" });
    return;
  }

  // Path B: employee/super by email + password
  const rows = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email.toLowerCase())).limit(1);
  if (rows.length === 0 || !rows[0].passwordHash) { res.status(401).json({ error: "bad_credentials" }); return; }
  const u = rows[0];
  if (!verifyPassword(password, u.passwordHash!)) { res.status(401).json({ error: "bad_credentials" }); return; }
  // If this credential is still the invite token, enforce its expiry.
  if (u.inviteToken && verifyPassword(u.inviteToken, u.passwordHash!)) {
    if (u.inviteExpiresAt && u.inviteExpiresAt.getTime() < Date.now()) {
      res.status(401).json({ error: "invite_expired" });
      return;
    }
  }
  // Clear invite token on first successful login (so it can't be reused indefinitely).
  await db
    .update(adminUsersTable)
    .set({ lastLoginAt: new Date(), inviteToken: null, inviteExpiresAt: null })
    .where(eq(adminUsersTable.id, u.id));
  const token = await createSession(u.id, u.role as "super" | "employee");
  await logActivity({ source: "session", role: u.role as "super" | "employee", userId: u.id, email: u.email }, "login");
  res.json({ token, role: u.role, email: u.email });
});

router.get("/admin/auth/me", requireAdmin, async (req, res) => {
  const ctx = req.adminContext!;
  res.json({
    role: ctx.role,
    email: ctx.email ?? null,
    source: ctx.source,
    needsPasswordSetup: ctx.source === "env",
  });
});

const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post("/admin/auth/change-password", requireAdmin, async (req, res) => {
  const ctx = req.adminContext!;
  if (ctx.role !== "super") { res.status(403).json({ error: "forbidden" }); return; }
  const parsed = changePwSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "bad_input", message: "كلمة المرور الجديدة يجب أن لا تقل عن ٨ أحرف" }); return; }
  const { currentPassword, newPassword } = parsed.data;

  if (ctx.source === "env") {
    // Bootstrap: current must match env token, then create the super admin row
    if (currentPassword !== process.env.ADMIN_TOKEN) { res.status(401).json({ error: "bad_current" }); return; }
    const email = (req.body?.email as string | undefined)?.toLowerCase() || "admin@platform.local";
    const existing = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email)).limit(1);
    if (existing.length > 0) {
      await db.update(adminUsersTable).set({ passwordHash: hashPassword(newPassword), role: "super" }).where(eq(adminUsersTable.id, existing[0].id));
    } else {
      await db.insert(adminUsersTable).values({ email, passwordHash: hashPassword(newPassword), role: "super" });
    }
    await logActivity(ctx, "password_change", { summary: "تعيين كلمة مرور المسؤول لأول مرة" });
    res.json({ ok: true, bootstrap: true });
    return;
  }

  const me = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, ctx.userId!)).limit(1);
  if (me.length === 0 || !me[0].passwordHash || !verifyPassword(currentPassword, me[0].passwordHash)) {
    res.status(401).json({ error: "bad_current" });
    return;
  }
  await db.update(adminUsersTable).set({ passwordHash: hashPassword(newPassword) }).where(eq(adminUsersTable.id, ctx.userId!));
  await logActivity(ctx, "password_change");
  res.json({ ok: true });
});

export default router;
