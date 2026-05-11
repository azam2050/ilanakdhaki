import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, merchantsTable, adAccountsTable } from "@workspace/db";
import { hashPassword, verifyPassword } from "../../lib/adminAuth";
import { createSession, setSessionCookie } from "../../lib/session";
import { clientIp, recordFailedLogin } from "../../lib/security";

const router: IRouter = Router();

// ── Register ──────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(128),
  storeName: z.string().min(2).max(255).trim(),
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "بيانات غير صالحة",
      details: parsed.error.issues.map((i) => i.message),
    });
    return;
  }

  const { email, password, storeName } = parsed.data;

  // Check if email already registered
  const existing = await db
    .select({ id: merchantsTable.id })
    .from(merchantsTable)
    .where(eq(merchantsTable.email, email))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "البريد الإلكتروني مسجّل مسبقاً" });
    return;
  }

  const passwordHashValue = hashPassword(password);

  const [merchant] = await db
    .insert(merchantsTable)
    .values({
      email,
      passwordHash: passwordHashValue,
      storeName,
      ownerEmail: email,
    })
    .returning({ id: merchantsTable.id });

  if (!merchant) {
    res.status(500).json({ error: "حدث خطأ أثناء إنشاء الحساب" });
    return;
  }

  const sessionToken = await createSession(merchant.id);
  setSessionCookie(res, sessionToken);

  res.status(201).json({
    merchantId: merchant.id,
    storeName,
    plan: "trial",
    status: "active",
    consentAccepted: false,
    connectedPlatforms: [],
  });
});

// ── Login (email/password) ────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(1).max(128),
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  const { email, password } = parsed.data;

  const [merchant] = await db
    .select()
    .from(merchantsTable)
    .where(eq(merchantsTable.email, email))
    .limit(1);

  if (!merchant || !merchant.passwordHash) {
    recordFailedLogin(clientIp(req), "merchant:not_found");
    res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return;
  }

  if (!verifyPassword(password, merchant.passwordHash)) {
    recordFailedLogin(clientIp(req), "merchant:bad_password");
    res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return;
  }

  if (merchant.status === "suspended") {
    res.status(403).json({ error: "الحساب موقوف. تواصل مع الدعم." });
    return;
  }

  const sessionToken = await createSession(merchant.id);
  setSessionCookie(res, sessionToken);

  const accts = await db
    .select({ platform: adAccountsTable.platform })
    .from(adAccountsTable)
    .where(eq(adAccountsTable.merchantId, merchant.id));

  res.json({
    merchantId: merchant.id,
    storeName: merchant.storeName,
    ownerName: merchant.ownerEmail ?? null,
    plan: merchant.plan,
    status: merchant.status,
    consentAccepted: merchant.consents?.acceptedAt != null,
    connectedPlatforms: accts.map((a) => a.platform),
  });
});

export default router;
