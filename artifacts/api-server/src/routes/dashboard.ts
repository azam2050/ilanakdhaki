import { Router, type IRouter } from "express";
import { sql, eq, and, desc, gte, lt } from "drizzle-orm";
import {
  db,
  networkEventsTable,
  campaignsTable,
  aiDecisionsTable,
  seasonalAlertsTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/requireSession";

const router: IRouter = Router();

const PLATFORM_LABELS: Record<string, string> = {
  meta: "ميتا",
  snap: "سناب شات",
  tiktok: "تيك توك",
  google: "قوقل",
};

function startOfTodayRiyadh(): Date {
  // Riyadh is UTC+3 (no DST). Compute the UTC instant that corresponds to the
  // start of "today" in Riyadh.
  const now = new Date();
  const utcMs = now.getTime();
  const riyadhMs = utcMs + 3 * 60 * 60 * 1000;
  const riyadhDay = new Date(riyadhMs);
  riyadhDay.setUTCHours(0, 0, 0, 0);
  return new Date(riyadhDay.getTime() - 3 * 60 * 60 * 1000);
}

router.get("/dashboard/greeting", requireSession, (req, res) => {
  const m = req.merchant!;
  const hour = new Date().getUTCHours() + 3; // Riyadh
  const h = ((hour % 24) + 24) % 24;
  const name = m.ownerName || m.storeName;

  // Time-of-day greeting variants. Pick deterministically per day so the
  // merchant doesn't see it bouncing on every refresh.
  const dayKey = Math.floor((Date.now() + 3 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000));
  const pick = <T,>(arr: T[]): T => arr[dayKey % arr.length]!;

  let greetingArabic: string;
  let subtitleArabic: string;

  if (h < 12) {
    greetingArabic = pick([
      `صباح الخير ${name} ☀️`,
      `يسعد صباحك ${name} 🌅`,
      `صباح النور ${name} ☀️`,
    ]);
    subtitleArabic = pick([
      "أنا شغّال من أمس على حملتك — هذا ملخّص اليوم 👇",
      "هذا اللي صار من أمس لين الحين 👇",
      "خلّيك مرتاح، أنا على الموضوع — هذا تحديث اليوم 👇",
    ]);
  } else if (h < 17) {
    greetingArabic = pick([
      `مساء النور ${name} 🌤️`,
      `يا هلا ${name} 👋`,
      `مساك الله بالخير ${name} ☕`,
    ]);
    subtitleArabic = "أراقب الحملة من الصبح — هذا اللي صار 👇";
  } else {
    greetingArabic = pick([
      `مساء الخير ${name} 🌙`,
      `مساك ورد ${name} ✨`,
      `يا هلا ${name} 👋`,
    ]);
    subtitleArabic = "أنا أراقبها كل ربع ساعة — هذا ملخّص اليوم 👇";
  }

  res.json({
    greetingArabic,
    subtitleArabic,
    merchantName: name,
  });
});

router.get("/dashboard/today", requireSession, async (req, res) => {
  const m = req.merchant!;
  const todayStart = startOfTodayRiyadh();
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  // Orders + revenue from purchases today (and yesterday for delta)
  const [todayPurchases] = await db
    .select({
      orders: sql<number>`COALESCE(COUNT(*), 0)::int`,
      revenue: sql<number>`COALESCE(SUM(${networkEventsTable.orderValue}), 0)::float`,
    })
    .from(networkEventsTable)
    .where(
      and(
        eq(networkEventsTable.merchantId, m.id),
        eq(networkEventsTable.eventType, "purchase"),
        gte(networkEventsTable.occurredAt, todayStart),
      ),
    );

  const [yesterdayPurchases] = await db
    .select({
      orders: sql<number>`COALESCE(COUNT(*), 0)::int`,
      revenue: sql<number>`COALESCE(SUM(${networkEventsTable.orderValue}), 0)::float`,
    })
    .from(networkEventsTable)
    .where(
      and(
        eq(networkEventsTable.merchantId, m.id),
        eq(networkEventsTable.eventType, "purchase"),
        gte(networkEventsTable.occurredAt, yesterdayStart),
        lt(networkEventsTable.occurredAt, todayStart),
      ),
    );

  // Spend from active campaigns today
  const [spendRow] = await db
    .select({
      spend: sql<number>`COALESCE(SUM(${campaignsTable.spentToday}), 0)::float`,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.merchantId, m.id));

  const orders = todayPurchases?.orders ?? 0;
  const revenue = todayPurchases?.revenue ?? 0;
  const spend = spendRow?.spend ?? 0;
  const yOrders = yesterdayPurchases?.orders ?? 0;
  const yRevenue = yesterdayPurchases?.revenue ?? 0;

  const pct = (curr: number, prev: number): number => {
    if (prev <= 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  res.json({
    orders,
    spend: Math.round(spend * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    costPerOrder: orders > 0 ? Math.round((spend / orders) * 100) / 100 : null,
    roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : null,
    currency: "SAR",
    deltaVsYesterday: {
      ordersPct: pct(orders, yOrders),
      spendPct: 0,
      revenuePct: pct(revenue, yRevenue),
    },
  });
});

router.get("/dashboard/ai-decisions", requireSession, async (req, res) => {
  const m = req.merchant!;
  const limitRaw = Number(req.query.limit ?? 20);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;
  const rows = await db
    .select()
    .from(aiDecisionsTable)
    .where(eq(aiDecisionsTable.merchantId, m.id))
    .orderBy(desc(aiDecisionsTable.executedAt))
    .limit(limit);
  res.json(
    rows.map((r) => ({
      id: r.id,
      decisionType: r.decisionType,
      reasonArabic: r.reasonArabic,
      resultArabic: r.resultArabic ?? null,
      executedAt: r.executedAt.toISOString(),
    })),
  );
});

router.get("/dashboard/platforms", requireSession, async (req, res) => {
  const m = req.merchant!;
  const rows = await db
    .select({
      platform: campaignsTable.platform,
      orders: sql<number>`COALESCE(SUM(${campaignsTable.ordersToday}), 0)::int`,
      spend: sql<number>`COALESCE(SUM(${campaignsTable.spentToday}), 0)::float`,
      cpo: sql<number | null>`AVG(${campaignsTable.costPerOrder})::float`,
      roas: sql<number | null>`AVG(${campaignsTable.roas})::float`,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.merchantId, m.id))
    .groupBy(campaignsTable.platform);

  const totalSpend = rows.reduce((s, r) => s + (r.spend ?? 0), 0) || 1;
  res.json(
    rows.map((r) => ({
      platform: r.platform,
      platformLabelArabic: PLATFORM_LABELS[r.platform] ?? r.platform,
      orders: r.orders ?? 0,
      spend: Math.round((r.spend ?? 0) * 100) / 100,
      costPerOrder: r.cpo == null ? null : Math.round(r.cpo * 100) / 100,
      roas: r.roas == null ? null : Math.round(r.roas * 100) / 100,
      share: Math.round(((r.spend ?? 0) / totalSpend) * 1000) / 10,
    })),
  );
});

router.get("/dashboard/cities", requireSession, async (req, res) => {
  const m = req.merchant!;
  const cityRows = await db
    .select({
      city: networkEventsTable.city,
      orders: sql<number>`COALESCE(COUNT(*), 0)::int`,
      revenue: sql<number>`COALESCE(SUM(${networkEventsTable.orderValue}), 0)::float`,
    })
    .from(networkEventsTable)
    .where(
      and(
        eq(networkEventsTable.merchantId, m.id),
        eq(networkEventsTable.eventType, "purchase"),
      ),
    )
    .groupBy(networkEventsTable.city)
    .orderBy(desc(sql`COUNT(*)`));

  const districtRows = await db
    .select({
      city: networkEventsTable.city,
      district: networkEventsTable.district,
      orders: sql<number>`COALESCE(COUNT(*), 0)::int`,
    })
    .from(networkEventsTable)
    .where(
      and(
        eq(networkEventsTable.merchantId, m.id),
        eq(networkEventsTable.eventType, "purchase"),
      ),
    )
    .groupBy(networkEventsTable.city, networkEventsTable.district);

  res.json(
    cityRows
      .filter((r) => r.city != null)
      .map((c) => ({
        city: c.city!,
        orders: c.orders ?? 0,
        revenue: Math.round((c.revenue ?? 0) * 100) / 100,
        topDistricts: districtRows
          .filter((d) => d.city === c.city && d.district != null)
          .sort((a, b) => (b.orders ?? 0) - (a.orders ?? 0))
          .slice(0, 5)
          .map((d) => ({ district: d.district!, orders: d.orders ?? 0 })),
      })),
  );
});

router.get("/dashboard/customers", requireSession, async (req, res) => {
  const m = req.merchant!;
  const baseFilter = and(
    eq(networkEventsTable.merchantId, m.id),
    eq(networkEventsTable.eventType, "purchase"),
  );

  const [totalRow] = await db
    .select({
      total: sql<number>`COALESCE(COUNT(DISTINCT ${networkEventsTable.customerEmailHash}), 0)::int`,
    })
    .from(networkEventsTable)
    .where(baseFilter);

  const cityRows = await db
    .select({
      city: networkEventsTable.city,
      orders: sql<number>`COALESCE(COUNT(*), 0)::int`,
    })
    .from(networkEventsTable)
    .where(baseFilter)
    .groupBy(networkEventsTable.city)
    .orderBy(desc(sql`COUNT(*)`));

  const ageRows = await db
    .select({
      bracket: networkEventsTable.customerAgeBracket,
      orders: sql<number>`COALESCE(COUNT(*), 0)::int`,
    })
    .from(networkEventsTable)
    .where(baseFilter)
    .groupBy(networkEventsTable.customerAgeBracket);

  const productRows = await db
    .select({
      name: networkEventsTable.productName,
      orders: sql<number>`COALESCE(COUNT(*), 0)::int`,
    })
    .from(networkEventsTable)
    .where(baseFilter)
    .groupBy(networkEventsTable.productName)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(8);

  const cityTotal = cityRows.reduce((s, r) => s + (r.orders ?? 0), 0) || 1;
  const ageTotal = ageRows.reduce((s, r) => s + (r.orders ?? 0), 0) || 1;

  const ageOrder = ["18-24", "25-34", "35-44", "45-54", "55+"];

  res.json({
    totalCustomers: totalRow?.total ?? 0,
    cityDistribution: cityRows
      .filter((r) => r.city != null)
      .slice(0, 6)
      .map((r) => ({
        city: r.city!,
        share: Math.round(((r.orders ?? 0) / cityTotal) * 1000) / 10,
      })),
    ageDistribution: ageRows
      .filter((r) => r.bracket != null)
      .map((r) => ({
        bracket: r.bracket!,
        share: Math.round(((r.orders ?? 0) / ageTotal) * 1000) / 10,
      }))
      .sort(
        (a, b) => ageOrder.indexOf(a.bracket) - ageOrder.indexOf(b.bracket),
      ),
    topProducts: productRows
      .filter((r) => r.name != null)
      .map((r) => ({ name: r.name!, orders: r.orders ?? 0 })),
  });
});

router.get("/dashboard/seasonal-alerts", requireSession, async (_req, res) => {
  const rows = await db
    .select()
    .from(seasonalAlertsTable)
    .where(eq(seasonalAlertsTable.active, true))
    .orderBy(seasonalAlertsTable.triggerDate);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  res.json(
    rows
      .map((r) => ({
        id: r.id,
        nameArabic: r.nameArabic,
        triggerDate: r.triggerDate.toISOString(),
        daysUntil: Math.round((r.triggerDate.getTime() - now) / dayMs),
        targetCategories: r.targetCategories ?? [],
      }))
      .filter((r) => r.daysUntil >= -1 && r.daysUntil <= 90),
  );
});

export default router;
