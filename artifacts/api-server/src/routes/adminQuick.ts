import { Router, type IRouter } from "express";
import { z } from "zod";
import { sql, desc } from "drizzle-orm";
import { db, merchantsTable, seasonalAlertsTable, campaignsTable, networkEventsTable } from "@workspace/db";
import { requireAdmin, requireAdminRole } from "../middlewares/requireAdmin";
import { logActivity } from "../lib/adminAuth";
import { sendTelegramAlert, isTelegramConfigured } from "../lib/telegram";

const router: IRouter = Router();

// Real-time stats: lightweight aggregates
router.get("/admin/stats/realtime", requireAdmin, async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [active] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(merchantsTable)
    .where(sql`${merchantsTable.status} IN ('active','trialing')`);

  const [spendAgg] = await db
    .select({ spend: sql<number>`COALESCE(SUM(${campaignsTable.spentToday}),0)::float` })
    .from(campaignsTable);

  const [ordersAgg] = await db
    .select({ orders: sql<number>`COUNT(*)::int` })
    .from(networkEventsTable)
    .where(sql`${networkEventsTable.eventType} = 'purchase' AND ${networkEventsTable.occurredAt} >= ${startOfToday.toISOString()}`);

  const orders = ordersAgg?.orders ?? 0;
  const spend = spendAgg?.spend ?? 0;
  const avgOrderCost = orders > 0 ? spend / orders : 0;

  res.json({
    activeMerchants: active?.n ?? 0,
    spendTodaySar: Math.round(spend),
    ordersToday: orders,
    avgOrderCostSar: Math.round(avgOrderCost),
  });
});

// Quick action: broadcast notification (Telegram operator channel + activity log)
const broadcastSchema = z.object({ message: z.string().min(1).max(1000) });

router.post("/admin/broadcast", requireAdminRole("super"), async (req, res) => {
  const ctx = req.adminContext!;
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "bad_input" }); return; }
  const { message } = parsed.data;

  const merchantsCount = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(merchantsTable)
    .where(sql`${merchantsTable.status} IN ('active','trialing')`);
  const count = merchantsCount[0]?.n ?? 0;

  let telegramOk = false;
  if (isTelegramConfigured()) {
    const r = await sendTelegramAlert(`<b>📣 إشعار جماعي</b>\nمن: ${ctx.email ?? "المدير"}\nالعدد: ${count} تاجر\n\n${message}`);
    telegramOk = r.ok;
  }
  await logActivity(ctx, "broadcast", { summary: `إشعار جماعي إلى ${count} تاجر` });
  res.json({ ok: true, recipients: count, telegramOk });
});

// Quick action: export merchants as CSV (Excel-compatible UTF-8 BOM)
router.get("/admin/export/merchants.csv", requireAdmin, async (req, res) => {
  const ctx = req.adminContext!;
  const rows = await db.select().from(merchantsTable).orderBy(desc(merchantsTable.createdAt));
  const headers = ["id","store_name","category","sub_category","city","plan","status","created_at"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(",")].concat(
    rows.map((r) => [r.id, r.storeName, r.category, r.subCategory, r.city, r.plan, r.status, r.createdAt.toISOString()].map(escape).join(",")),
  ).join("\n");
  await logActivity(ctx, "export_merchants", { summary: `تصدير ${rows.length} تاجر` });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="merchants.csv"`);
  res.send("\uFEFF" + csv);
});

// Quick action: add a new seasonal alert
const addSeasonSchema = z.object({
  nameArabic: z.string().min(1).max(128),
  triggerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  triggerDaysBefore: z.coerce.number().int().min(1).max(120).default(7),
  targetCategories: z.array(z.string()).optional(),
});

router.post("/admin/seasonal-alerts", requireAdminRole("super"), async (req, res) => {
  const ctx = req.adminContext!;
  const parsed = addSeasonSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "bad_input", issues: parsed.error.issues }); return; }
  const v = parsed.data;
  const ins = await db.insert(seasonalAlertsTable).values({
    nameArabic: v.nameArabic,
    triggerDate: new Date(v.triggerDate + "T00:00:00Z"),
    triggerDaysBefore: v.triggerDaysBefore,
    targetCategories: v.targetCategories ?? null,
    active: true,
  }).returning();
  await logActivity(ctx, "season_add", { targetType: "seasonal_alert", targetId: ins[0]?.id, summary: `موسم جديد: ${v.nameArabic}` });
  res.json({ ok: true, item: ins[0] });
});

void campaignsTable;

export default router;
