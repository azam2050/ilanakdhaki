import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";
import { requireAdminRole } from "../middlewares/requireAdmin";
import { hashPassword, newToken, logActivity, listRecentActivity } from "../lib/adminAuth";
import { sendEmail, isEmailConfigured } from "../lib/email";

const router: IRouter = Router();

router.get("/admin/team", requireAdminRole("super"), async (_req, res) => {
  const rows = await db.select().from(adminUsersTable).orderBy(desc(adminUsersTable.createdAt));
  res.json(rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.createdAt.toISOString(),
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    pendingInvite: !!r.inviteToken,
  })));
});

const addSchema = z.object({ email: z.string().email() });

router.post("/admin/team", requireAdminRole("super"), async (req, res) => {
  const ctx = req.adminContext!;
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "bad_email" }); return; }
  const email = parsed.data.email.toLowerCase();

  const existing = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email)).limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "already_exists" }); return; }

  const inviteToken = newToken();
  const inviteExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  // Set passwordHash from inviteToken so user can log in with it then change password
  await db.insert(adminUsersTable).values({
    email,
    role: "employee",
    passwordHash: hashPassword(inviteToken),
    inviteToken,
    inviteExpiresAt,
  });
  await logActivity(ctx, "team_add", { targetType: "admin_user", targetId: email, summary: `إضافة موظف: ${email}` });

  let emailSent = false;
  if (isEmailConfigured()) {
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = req.headers["x-forwarded-host"] || req.headers["host"];
    const loginUrl = `${proto}://${host}/merchant-dashboard/admin/login?email=${encodeURIComponent(email)}&t=${inviteToken}`;
    const html = `
      <div dir="rtl" style="font-family:system-ui,'Segoe UI',Tahoma;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">دعوة للانضمام إلى لوحة الإدارة</h2>
        <p>تمت دعوتك لإدارة منصة الإعلانات الذكية كموظف.</p>
        <p>اضغط الرابط أدناه لتسجيل الدخول لأول مرة. كلمة المرور المؤقتة مدمجة في الرابط.</p>
        <p><a href="${loginUrl}" style="display:inline-block;background:#b8860b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">دخول إلى اللوحة</a></p>
        <p style="color:#64748b;font-size:12px">صالحة لمدة ٧ أيام.</p>
      </div>`;
    const r = await sendEmail({ to: email, subject: "دعوة إلى لوحة إدارة الإعلانات الذكية", html });
    emailSent = r.ok;
  }

  res.json({ ok: true, email, emailSent, inviteToken: emailSent ? null : inviteToken });
});

router.delete("/admin/team/:id", requireAdminRole("super"), async (req, res) => {
  const ctx = req.adminContext!;
  const id = req.params.id;
  const rows = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, id)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
  if (rows[0].role === "super") { res.status(400).json({ error: "cannot_remove_super" }); return; }
  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id));
  await logActivity(ctx, "team_remove", { targetType: "admin_user", targetId: rows[0].email, summary: `إزالة موظف: ${rows[0].email}` });
  res.json({ ok: true });
});

router.get("/admin/activity", requireAdminRole("super"), async (_req, res) => {
  const items = await listRecentActivity(20);
  res.json(items);
});

export default router;
