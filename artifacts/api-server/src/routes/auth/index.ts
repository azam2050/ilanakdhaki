import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, adAccountsTable } from "@workspace/db";
import sallaRouter from "./salla";
import {
  clearSessionCookie,
  destroySession,
  readSessionCookie,
} from "../../lib/session";
import { requireSession } from "../../middlewares/requireSession";

const router: IRouter = Router();

router.use(sallaRouter);

router.get("/auth/me", requireSession, async (req, res) => {
  const m = req.merchant!;
  const accounts = await db
    .select({ platform: adAccountsTable.platform })
    .from(adAccountsTable)
    .where(eq(adAccountsTable.merchantId, m.id));
  res.json({
    merchantId: m.id,
    storeName: m.storeName,
    ownerName: m.ownerEmail ?? null,
    plan: m.plan,
    status: m.status,
    consentAccepted: m.consents?.acceptedAt != null,
    connectedPlatforms: accounts.map((a) => a.platform),
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = readSessionCookie(req);
  if (token) await destroySession(token);
  clearSessionCookie(res);
  res.status(204).send();
});

export default router;
