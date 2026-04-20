import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  merchantsTable,
  adAccountsTable,
  segmentsTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/requireSession";
import { createSession, setSessionCookie } from "../lib/session";

const router: IRouter = Router();

const DEMO_SALLA_MERCHANT_ID = "99";

async function meResponse(merchantId: string) {
  const [m] = await db
    .select()
    .from(merchantsTable)
    .where(eq(merchantsTable.id, merchantId))
    .limit(1);
  if (!m) return null;
  const accts = await db
    .select({ platform: adAccountsTable.platform })
    .from(adAccountsTable)
    .where(eq(adAccountsTable.merchantId, merchantId));
  return {
    merchantId: m.id,
    storeName: m.storeName,
    ownerName: m.ownerEmail ?? null,
    plan: m.plan,
    status: m.status,
    consentAccepted: m.consents?.acceptedAt != null,
    connectedPlatforms: accts.map((a) => a.platform),
  };
}

router.post("/onboarding/start-demo", async (req, res): Promise<void> => {
  // Demo session is only available outside production. In production, merchants
  // must authenticate through Salla/Zid OAuth.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SESSION !== "true") {
    res.status(404).json({ error: "Not available" });
    return;
  }
  // Resolve the seeded demo merchant — created at install time.
  const [m] = await db
    .select()
    .from(merchantsTable)
    .where(eq(merchantsTable.sallaMerchantId, DEMO_SALLA_MERCHANT_ID))
    .limit(1);
  if (!m) {
    res.status(503).json({ error: "Demo merchant not provisioned" });
    return;
  }
  const token = await createSession(m.id);
  setSessionCookie(res, token);
  const me = await meResponse(m.id);
  res.json(me);
});

const consentSchema = z
  .object({
    readStoreData: z.boolean(),
    receiveWebhooks: z.boolean(),
    shareAudienceNetwork: z.boolean(),
    manageAdAccounts: z.boolean(),
  })
  .strict();

router.post("/onboarding/consent", requireSession, async (req, res): Promise<void> => {
  const merchant = req.merchant!;
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid consent payload" });
    return;
  }
  const consents = {
    ...parsed.data,
    acceptedAt: new Date().toISOString(),
  };
  await db
    .update(merchantsTable)
    .set({ consents })
    .where(eq(merchantsTable.id, merchant.id));
  const me = await meResponse(merchant.id);
  res.json(me);
});

router.get("/onboarding/audience-size", requireSession, async (req, res): Promise<void> => {
  const merchant = req.merchant!;
  // Pick the segment whose parent_category matches the merchant's category;
  // fall back to the first available segment so the welcome screen always has data.
  const [segByCategory] = merchant.subCategory
    ? await db
        .select()
        .from(segmentsTable)
        .where(eq(segmentsTable.name, merchant.subCategory))
        .limit(1)
    : [];
  const seg =
    segByCategory ??
    (await db.select().from(segmentsTable).limit(1)).at(0) ??
    null;
  if (!seg) {
    res.json({
      segmentName: "default",
      segmentDisplayName: "جمهور المملكة",
      totalBuyers: 0,
      totalMerchants: 0,
      topCities: [],
    });
    return;
  }
  res.json({
    segmentName: seg.name,
    segmentDisplayName: seg.displayName,
    totalBuyers: seg.totalBuyers,
    totalMerchants: seg.totalMerchants,
    topCities: seg.topCities ?? [],
  });
});

export default router;
