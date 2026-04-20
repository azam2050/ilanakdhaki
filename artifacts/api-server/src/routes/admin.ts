import { Router, type IRouter } from "express";
import { sql, eq, and, desc, gte } from "drizzle-orm";
import {
  db,
  merchantsTable,
  campaignsTable,
  networkEventsTable,
  segmentsTable,
  segmentAudiencesTable,
  adAccountsTable,
  aiDecisionsTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const PLATFORM_AR: Record<string, string> = {
  meta: "ميتا",
  snap: "سناب شات",
  tiktok: "تيك توك",
  google: "قوقل",
};

router.get("/admin/overview", requireAdmin, async (_req, res) => {
  const [merchantsCount] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(merchantsTable)
    .where(eq(merchantsTable.status, "active"));

  const [campaignsCount] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(campaignsTable)
    .where(eq(campaignsTable.status, "active"));

  const [spendRow] = await db
    .select({
      spend: sql<number>`COALESCE(SUM(${campaignsTable.spentToday}), 0)::float`,
      orders: sql<number>`COALESCE(SUM(${campaignsTable.ordersToday}), 0)::int`,
    })
    .from(campaignsTable);

  const last24h = new Date(Date.now() - 24 * 3600 * 1000);
  const [eventsRow] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(networkEventsTable)
    .where(
      and(
        eq(networkEventsTable.eventType, "purchase"),
        gte(networkEventsTable.occurredAt, last24h),
      ),
    );

  res.json({
    activeMerchants: merchantsCount?.n ?? 0,
    activeCampaigns: campaignsCount?.n ?? 0,
    spendTodaySar: Math.round((spendRow?.spend ?? 0) * 100) / 100,
    ordersToday: spendRow?.orders ?? 0,
    purchasesLast24h: eventsRow?.n ?? 0,
  });
});

router.get("/admin/merchants", requireAdmin, async (req, res) => {
  const filterSchema = z.object({
    category: z.string().optional(),
    city: z.string().optional(),
    plan: z.string().optional(),
  });
  const parsed = filterSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_filter" });
    return;
  }
  const { category, city, plan } = parsed.data;

  const conds = [];
  if (category) conds.push(eq(merchantsTable.category, category));
  if (city) conds.push(eq(merchantsTable.city, city));
  if (plan) conds.push(eq(merchantsTable.plan, plan));

  const rows = await db
    .select({
      id: merchantsTable.id,
      storeName: merchantsTable.storeName,
      category: merchantsTable.category,
      subCategory: merchantsTable.subCategory,
      city: merchantsTable.city,
      plan: merchantsTable.plan,
      status: merchantsTable.status,
      createdAt: merchantsTable.createdAt,
    })
    .from(merchantsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(merchantsTable.createdAt));

  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.get("/admin/merchants/:id", requireAdmin, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "bad_id" });
    return;
  }
  const [m] = await db
    .select()
    .from(merchantsTable)
    .where(eq(merchantsTable.id, id.data));
  if (!m) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const accounts = await db
    .select({
      id: adAccountsTable.id,
      platform: adAccountsTable.platform,
      status: adAccountsTable.status,
      connectedAt: adAccountsTable.connectedAt,
    })
    .from(adAccountsTable)
    .where(eq(adAccountsTable.merchantId, id.data));
  const camps = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.merchantId, id.data));
  const decisions = await db
    .select()
    .from(aiDecisionsTable)
    .where(eq(aiDecisionsTable.merchantId, id.data))
    .orderBy(desc(aiDecisionsTable.executedAt))
    .limit(20);

  res.json({
    merchant: {
      id: m.id,
      storeName: m.storeName,
      sallaMerchantId: m.sallaMerchantId,
      ownerEmail: m.ownerEmail,
      category: m.category,
      subCategory: m.subCategory,
      city: m.city,
      region: m.region,
      plan: m.plan,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    },
    adAccounts: accounts.map((a) => ({
      ...a,
      platformLabel: PLATFORM_AR[a.platform] ?? a.platform,
      connectedAt: a.connectedAt.toISOString(),
    })),
    campaigns: camps.map((c) => ({
      id: c.id,
      platform: c.platform,
      platformLabel: PLATFORM_AR[c.platform] ?? c.platform,
      name: c.name,
      status: c.status,
      dailyBudget: c.dailyBudget,
      spentToday: c.spentToday,
      ordersToday: c.ordersToday,
      costPerOrder: c.costPerOrder,
      roas: c.roas,
    })),
    recentDecisions: decisions.map((d) => ({
      id: d.id,
      decisionType: d.decisionType,
      reasonArabic: d.reasonArabic,
      executedAt: d.executedAt.toISOString(),
    })),
  });
});

router.get("/admin/segments", requireAdmin, async (_req, res) => {
  const segs = await db.select().from(segmentsTable);
  const auds = await db.select().from(segmentAudiencesTable);
  res.json(
    segs.map((s) => ({
      id: s.id,
      name: s.name,
      displayName: s.displayName,
      parentCategory: s.parentCategory,
      totalMerchants: s.totalMerchants,
      totalBuyers: s.totalBuyers,
      avgOrderValue: s.avgOrderValue,
      avgCpo: s.avgCpo,
      bestPlatform: s.bestPlatform,
      bestPlatformLabel: s.bestPlatform ? PLATFORM_AR[s.bestPlatform] ?? s.bestPlatform : null,
      bestTime: s.bestTime,
      topCities: s.topCities ?? [],
      peakSeasons: s.peakSeasons ?? [],
      audiences: auds
        .filter((a) => a.segmentId === s.id)
        .map((a) => ({
          platform: a.platform,
          platformLabel: PLATFORM_AR[a.platform] ?? a.platform,
          size: a.audienceSize,
        })),
    })),
  );
});

router.get("/admin/platforms", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      platform: campaignsTable.platform,
      activeCampaigns: sql<number>`COUNT(*)::int`,
      orders: sql<number>`COALESCE(SUM(${campaignsTable.ordersToday}), 0)::int`,
      spend: sql<number>`COALESCE(SUM(${campaignsTable.spentToday}), 0)::float`,
      avgCpo: sql<number | null>`AVG(${campaignsTable.costPerOrder})::float`,
      avgRoas: sql<number | null>`AVG(${campaignsTable.roas})::float`,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.status, "active"))
    .groupBy(campaignsTable.platform);

  res.json(
    rows.map((r) => ({
      platform: r.platform,
      platformLabel: PLATFORM_AR[r.platform] ?? r.platform,
      activeCampaigns: r.activeCampaigns,
      orders: r.orders ?? 0,
      spend: Math.round((r.spend ?? 0) * 100) / 100,
      avgCostPerOrder: r.avgCpo == null ? null : Math.round(r.avgCpo * 100) / 100,
      avgRoas: r.avgRoas == null ? null : Math.round(r.avgRoas * 100) / 100,
    })),
  );
});

const budgetSchema = z.object({ dailyBudgetSar: z.number().positive().max(100000) });
router.post("/admin/campaigns/:id/budget", requireAdmin, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "bad_id" }); return; }
  const body = budgetSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "bad_body" }); return; }
  const [updated] = await db
    .update(campaignsTable)
    .set({ dailyBudget: body.data.dailyBudgetSar.toFixed(2) })
    .where(eq(campaignsTable.id, id.data))
    .returning();
  if (!updated) { res.status(404).json({ error: "not_found" }); return; }
  await db.insert(aiDecisionsTable).values({
    merchantId: updated.merchantId,
    campaignId: updated.id,
    decisionType: "manual_budget",
    reasonArabic: `تم تعديل الميزانية يدوياً من قبل الفريق إلى ${body.data.dailyBudgetSar} ريال.`,
    params: { source: "admin", newBudget: body.data.dailyBudgetSar },
  });
  res.json({ ok: true });
});

router.post("/admin/campaigns/:id/pause", requireAdmin, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "bad_id" }); return; }
  const [updated] = await db
    .update(campaignsTable)
    .set({ status: "paused" })
    .where(eq(campaignsTable.id, id.data))
    .returning();
  if (!updated) { res.status(404).json({ error: "not_found" }); return; }
  await db.insert(aiDecisionsTable).values({
    merchantId: updated.merchantId,
    campaignId: updated.id,
    decisionType: "manual_pause",
    reasonArabic: "تم إيقاف الحملة يدوياً من قبل الفريق.",
    params: { source: "admin" },
  });
  res.json({ ok: true });
});

router.post("/admin/campaigns/:id/resume", requireAdmin, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "bad_id" }); return; }
  const [updated] = await db
    .update(campaignsTable)
    .set({ status: "active" })
    .where(eq(campaignsTable.id, id.data))
    .returning();
  if (!updated) { res.status(404).json({ error: "not_found" }); return; }
  res.json({ ok: true });
});

export default router;
