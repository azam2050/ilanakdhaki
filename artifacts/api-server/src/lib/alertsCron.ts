import { and, eq, gte } from "drizzle-orm";
import { db, seasonalAlertsTable, merchantsTable } from "@workspace/db";
import { sendEmail, renderArabicAlertEmail, isEmailConfigured } from "./email";
import { sendTelegramAlert } from "./telegram";
import { logger } from "./logger";

export async function runAlertsCycle(): Promise<{ alerts: number; emailed: number }> {
  const now = new Date();
  const alerts = await db
    .select()
    .from(seasonalAlertsTable)
    .where(and(eq(seasonalAlertsTable.active, true), gte(seasonalAlertsTable.triggerDate, now)));

  let emailed = 0;
  for (const a of alerts) {
    const ms = a.triggerDate.getTime() - now.getTime();
    const daysUntil = Math.ceil(ms / (24 * 3600 * 1000));
    // Notify at exactly trigger_days_before, T-3, T-1
    if (![a.triggerDaysBefore, 3, 1].includes(daysUntil)) continue;

    const targets = a.targetCategories ?? [];
    const merchants = targets.length
      ? await db
          .select()
          .from(merchantsTable)
          .where(eq(merchantsTable.status, "active"))
      : await db.select().from(merchantsTable).where(eq(merchantsTable.status, "active"));

    const filtered = targets.length
      ? merchants.filter((m) => m.category && targets.includes(m.category))
      : merchants;

    for (const m of filtered) {
      if (!m.ownerEmail) continue;
      const html = renderArabicAlertEmail({
        storeName: m.storeName,
        alertNameArabic: a.nameArabic,
        daysUntil,
        recommendation: `جهّز الميزانية وزوّدنا بأي صور جديدة للمنتجات. سنرفع صرف الإعلانات تلقائياً قبل الموسم بأيام.`,
      });
      const result = await sendEmail({
        to: m.ownerEmail,
        subject: `${a.nameArabic} — بعد ${daysUntil} يوم`,
        html,
      });
      if (result.ok) emailed++;
    }

    if (filtered.length > 0) {
      await sendTelegramAlert(
        `<b>تنبيه موسمي</b>\n${a.nameArabic} — بعد ${daysUntil} يوم\nأُرسل إلى ${filtered.length} تاجر.`,
      );
    }
  }
  return { alerts: alerts.length, emailed };
}

let timer: NodeJS.Timeout | null = null;

export function startAlertsCron(): void {
  if (timer) return;
  if (process.env.NODE_ENV === "test") return;
  if (process.env.DISABLE_ALERTS_CRON === "true") return;

  // Run once at startup, then every 24h at ~7:30am Riyadh (04:30 UTC)
  const tick = async () => {
    try {
      const r = await runAlertsCycle();
      logger.info({ ...r, emailConfigured: isEmailConfigured() }, "alerts cycle complete");
    } catch (err) {
      logger.error({ err: (err as Error).message }, "alerts cycle failed");
    }
  };

  function scheduleNext() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(4, 30, 0, 0);
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    const ms = next.getTime() - now.getTime();
    timer = setTimeout(async () => {
      await tick();
      scheduleNext();
    }, ms);
    logger.info({ ms, fireAt: next.toISOString() }, "alerts cron scheduled");
  }
  scheduleNext();
}
