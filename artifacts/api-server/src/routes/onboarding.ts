import { Router, type IRouter } from "express";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  merchantsTable,
  adAccountsTable,
  segmentsTable,
  campaignsTable,
  networkEventsTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
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

router.get("/onboarding/campaign-analysis", requireSession, async (req, res) => {
  const m = req.merchant!;
  const since = new Date(Date.now() - 30 * 86400 * 1000);

  // Aggregate the merchant's last 30 days from network_events + campaigns
  const [purchases] = await db
    .select({
      orders: sql<number>`COUNT(*)::int`,
      revenue: sql<number>`COALESCE(SUM(${networkEventsTable.orderValue}), 0)::float`,
    })
    .from(networkEventsTable)
    .where(
      and(
        eq(networkEventsTable.merchantId, m.id),
        eq(networkEventsTable.eventType, "purchase"),
        gte(networkEventsTable.occurredAt, since),
      ),
    );

  const platformRows = await db
    .select({
      platform: campaignsTable.platform,
      spend: sql<number>`COALESCE(SUM(${campaignsTable.spentToday}), 0)::float`,
      orders: sql<number>`COALESCE(SUM(${campaignsTable.ordersToday}), 0)::int`,
      cpo: sql<number | null>`AVG(${campaignsTable.costPerOrder})::float`,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.merchantId, m.id))
    .groupBy(campaignsTable.platform);

  const topProducts = await db
    .select({
      name: networkEventsTable.productName,
      orders: sql<number>`COUNT(*)::int`,
    })
    .from(networkEventsTable)
    .where(
      and(
        eq(networkEventsTable.merchantId, m.id),
        eq(networkEventsTable.eventType, "purchase"),
        gte(networkEventsTable.occurredAt, since),
      ),
    )
    .groupBy(networkEventsTable.productName)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(3);

  const totalOrders = purchases?.orders ?? 0;
  const totalRevenue = purchases?.revenue ?? 0;
  const totalSpend = platformRows.reduce((s, r) => s + (r.spend ?? 0), 0);
  const overallCpo = totalOrders > 0 ? totalSpend / totalOrders : null;

  if (totalOrders === 0 && platformRows.length === 0) {
    res.json({
      hasData: false,
      summary: "ما عندك بيانات حملات سابقة كافية بعد. سنبدأ معك من الصفر ونحسّن مع كل يوم.",
      recommendation: null,
    });
    return;
  }

  // Ask Claude to write the merchant-facing analysis
  const platformsText = platformRows
    .map((r) => `${r.platform}: صرف ${(r.spend ?? 0).toFixed(0)} ريال، ${r.orders ?? 0} طلب، تكلفة الطلب ${r.cpo?.toFixed(0) ?? "—"} ريال`)
    .join("\n");
  const prompt = `أنت مدير إعلانات يحلّل أداء متجر سعودي خلال آخر 30 يوم لتقديم توصية إطلاق فورية.

البيانات:
- المتجر: ${m.storeName}
- الفئة: ${m.category ?? "—"} / ${m.subCategory ?? "—"}
- إجمالي الطلبات: ${totalOrders}
- إجمالي المبيعات: ${totalRevenue.toFixed(0)} ريال
- إجمالي الصرف الإعلاني: ${totalSpend.toFixed(0)} ريال
- متوسط تكلفة الطلب: ${overallCpo?.toFixed(0) ?? "—"} ريال
- أداء كل منصة:
${platformsText || "(لا توجد حملات سابقة)"}
- أكثر المنتجات مبيعاً: ${topProducts.map((p) => p.name).filter(Boolean).join("، ") || "—"}

اكتب JSON فقط بهذا الشكل، عربية فصحى بسيطة:
{
  "summary": "جملتان كحد أقصى تلخّصان الأداء (مثل: كنت تنفق X ريال لكل طلب، الميزانية كانت في المنصة الخطأ).",
  "recommendation": {
    "product_name": "اسم المنتج المقترح للإطلاق",
    "suggested_budget_sar": رقم,
    "reason_arabic": "سبب التوصية بجملة قصيرة"
  }
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    const text = block?.type === "text" ? block.text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.json({ hasData: true, summary: "نحلّل بياناتك الآن.", recommendation: null });
      return;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    res.json({
      hasData: true,
      summary: parsed.summary ?? null,
      recommendation: parsed.recommendation ?? null,
      disclaimerArabic: "التوصيات مبنية على تحليل حملاتك. النتائج تتفاوت بناءً على عوامل متعددة.",
    });
  } catch (err) {
    res.json({ hasData: true, summary: "نحلّل بياناتك الآن.", recommendation: null, error: (err as Error).message });
  }
});

export default router;
