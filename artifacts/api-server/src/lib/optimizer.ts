import { db, campaignsTable, aiDecisionsTable, segmentsTable, merchantsTable } from "@workspace/db";
import { sendTelegramAlert } from "./telegram";
import { eq, and } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger";

const PLATFORM_AR: Record<string, string> = {
  meta: "ميتا",
  snap: "سناب شات",
  tiktok: "تيك توك",
  google: "قوقل",
};

type Trigger =
  | { kind: "high_cpo"; cpo: number; segmentAvg: number }
  | { kind: "low_roas"; roas: number }
  | { kind: "budget_depleted"; spent: number; budget: number };

interface CampaignRow {
  id: string;
  merchantId: string;
  platform: string;
  name: string | null;
  dailyBudget: string | null;
  spentToday: string;
  ordersToday: number;
  costPerOrder: string | null;
  roas: string | null;
  status: string;
}

function detectTriggers(c: CampaignRow, segmentAvgCpo: number | null): Trigger | null {
  const cpo = c.costPerOrder == null ? null : Number(c.costPerOrder);
  const roas = c.roas == null ? null : Number(c.roas);
  const budget = c.dailyBudget == null ? null : Number(c.dailyBudget);
  const spent = Number(c.spentToday);

  if (cpo != null && segmentAvgCpo != null && cpo > segmentAvgCpo * 1.5) {
    return { kind: "high_cpo", cpo, segmentAvg: segmentAvgCpo };
  }
  if (roas != null && roas < 1.5) {
    return { kind: "low_roas", roas };
  }
  if (budget != null && budget > 0 && spent / budget >= 0.8) {
    return { kind: "budget_depleted", spent, budget };
  }
  return null;
}

interface ClaudeDecision {
  action: "increase_budget" | "shift_audience" | "refresh_creative" | "pause_platform" | "hold";
  delta_sar?: number;
  reason_arabic: string;
}

async function askClaude(c: CampaignRow, trigger: Trigger): Promise<ClaudeDecision | null> {
  const platformAr = PLATFORM_AR[c.platform] ?? c.platform;
  const triggerLine =
    trigger.kind === "high_cpo"
      ? `تكلفة الطلب ${trigger.cpo.toFixed(2)} ريال، متوسط الشبكة ${trigger.segmentAvg.toFixed(2)} ريال (أعلى بـ ${(((trigger.cpo - trigger.segmentAvg) / trigger.segmentAvg) * 100).toFixed(0)}%).`
      : trigger.kind === "low_roas"
      ? `العائد على الإعلان ${trigger.roas.toFixed(2)} وهو أقل من 1.5.`
      : `صرفت ${trigger.spent.toFixed(0)} من ${trigger.budget.toFixed(0)} ريال (${Math.round((trigger.spent / trigger.budget) * 100)}%).`;

  const prompt = `أنت مدير حملات إعلانية لمتجر سعودي. الحملة الحالية:
- منصة: ${platformAr}
- اسم: ${c.name ?? "—"}
- ميزانية اليوم: ${c.dailyBudget ?? "—"} ريال
- صُرف: ${c.spentToday} ريال
- طلبات: ${c.ordersToday}
- تكلفة الطلب: ${c.costPerOrder ?? "—"} ريال
- العائد على الإعلان: ${c.roas ?? "—"}

التنبيه: ${triggerLine}

اختر إجراء واحد من: increase_budget | shift_audience | refresh_creative | pause_platform | hold
وأعطِ السبب بالعربية الفصحى البسيطة بجملة واحدة قصيرة (لا تذكر شبكة أو بيانات تجار آخرين).
أعد JSON فقط:
{"action":"...","delta_sar":<رقم اختياري>,"reason_arabic":"..."}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    const text = block?.type === "text" ? block.text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as ClaudeDecision;
    if (
      !parsed.action ||
      !["increase_budget", "shift_audience", "refresh_creative", "pause_platform", "hold"].includes(parsed.action) ||
      typeof parsed.reason_arabic !== "string" ||
      parsed.reason_arabic.length < 5
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    logger.error({ err: (err as Error).message, campaignId: c.id }, "Claude optimizer call failed");
    return null;
  }
}

async function executeDecision(c: CampaignRow, d: ClaudeDecision): Promise<void> {
  if (d.action === "hold") {
    await db.insert(aiDecisionsTable).values({
      merchantId: c.merchantId,
      campaignId: c.id,
      decisionType: "hold",
      reasonArabic: d.reason_arabic,
      params: { trigger: "scheduled_check" },
    });
    return;
  }

  if (d.action === "pause_platform") {
    await db
      .update(campaignsTable)
      .set({ status: "paused" })
      .where(eq(campaignsTable.id, c.id));
  } else if (d.action === "increase_budget" && d.delta_sar && c.dailyBudget) {
    const next = (Number(c.dailyBudget) + Number(d.delta_sar)).toFixed(2);
    await db
      .update(campaignsTable)
      .set({ dailyBudget: next })
      .where(eq(campaignsTable.id, c.id));
  }
  // shift_audience and refresh_creative are recorded as decisions; actual ad-platform
  // mutations happen in a separate worker once real ad-account tokens are in play.

  await db.insert(aiDecisionsTable).values({
    merchantId: c.merchantId,
    campaignId: c.id,
    decisionType: d.action,
    reasonArabic: d.reason_arabic,
    params: { delta_sar: d.delta_sar ?? null },
  });
}

export async function runOptimizationCycle(): Promise<{ checked: number; triggered: number; decided: number }> {
  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.status, "active"));

  // Single segment fallback: cycle uses the global "abayas_classic" segment avg
  // until per-merchant segment mapping is wired in onboarding.
  const [seg] = await db
    .select()
    .from(segmentsTable)
    .where(eq(segmentsTable.name, "abayas_classic"));
  const segmentAvg = seg?.avgCpo == null ? null : Number(seg.avgCpo);

  let triggered = 0;
  let decided = 0;
  for (const raw of campaigns) {
    const c: CampaignRow = {
      id: raw.id,
      merchantId: raw.merchantId,
      platform: raw.platform,
      name: raw.name,
      dailyBudget: raw.dailyBudget,
      spentToday: raw.spentToday,
      ordersToday: raw.ordersToday,
      costPerOrder: raw.costPerOrder,
      roas: raw.roas,
      status: raw.status,
    };
    const trigger = detectTriggers(c, segmentAvg);
    if (!trigger) continue;
    triggered++;
    const decision = await askClaude(c, trigger);
    if (!decision) continue;
    await executeDecision(c, decision);
    decided++;

    if (decision.action === "pause_platform" || decision.action === "shift_audience") {
      try {
        const [m] = await db
          .select({ storeName: merchantsTable.storeName })
          .from(merchantsTable)
          .where(eq(merchantsTable.id, c.merchantId));
        const storeName = m?.storeName ?? "متجر";
        const actionAr =
          decision.action === "pause_platform" ? "إيقاف منصة" : "تحويل ميزانية";
        await sendTelegramAlert(
          `<b>${actionAr}</b>\nالمتجر: ${storeName}\nالحملة: ${c.name}\nالمنصة: ${c.platform}\nالسبب: ${decision.reason_arabic}`,
        );
      } catch {
        /* swallow */
      }
    }
  }
  return { checked: campaigns.length, triggered, decided };
}

let timer: NodeJS.Timeout | null = null;

export function startOptimizer(): void {
  if (timer) return;
  if (process.env.NODE_ENV === "test") return;
  if (process.env.DISABLE_OPTIMIZER === "true") return;

  const intervalMs = 15 * 60 * 1000;
  const tick = async () => {
    try {
      const r = await runOptimizationCycle();
      logger.info(r, "optimizer cycle complete");
    } catch (err) {
      logger.error({ err: (err as Error).message }, "optimizer cycle failed");
    }
  };
  // First run after 60s so the server has time to settle.
  setTimeout(() => {
    void tick();
    timer = setInterval(() => void tick(), intervalMs);
  }, 60_000);
  logger.info({ intervalMs }, "optimizer scheduled");
}
