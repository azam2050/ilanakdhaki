import { db, merchantsTable, networkEventsTable, aiDecisionsTable, seasonalAlertsTable } from "@workspace/db";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger";

interface MerchantSummary {
  id: string;
  storeName: string;
  category: string | null;
  subCategory: string | null;
  topProducts: string[];
  upcomingSeason: string | null;
}

async function buildMerchantSummary(merchantId: string, storeName: string, category: string | null, subCategory: string | null): Promise<MerchantSummary> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const products = await db
    .select({
      name: networkEventsTable.productName,
      orders: sql<number>`COUNT(*)::int`,
    })
    .from(networkEventsTable)
    .where(
      and(
        eq(networkEventsTable.merchantId, merchantId),
        eq(networkEventsTable.eventType, "purchase"),
        gte(networkEventsTable.occurredAt, fourteenDaysAgo),
      ),
    )
    .groupBy(networkEventsTable.productName)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(5);

  const seasonRows = await db
    .select()
    .from(seasonalAlertsTable)
    .where(eq(seasonalAlertsTable.active, true))
    .orderBy(seasonalAlertsTable.triggerDate);
  const now = Date.now();
  const upcoming = seasonRows.find((s) => {
    const days = (s.triggerDate.getTime() - now) / 86400000;
    return days >= 0 && days <= s.triggerDaysBefore;
  });

  return {
    id: merchantId,
    storeName,
    category,
    subCategory,
    topProducts: products.map((p) => p.name).filter((n): n is string => !!n),
    upcomingSeason: upcoming?.nameArabic ?? null,
  };
}

async function generateLines(m: MerchantSummary): Promise<string[]> {
  const prompt = `أنت كاتب إعلانات سعودي محترف لمتجر "${m.storeName}".
الفئة: ${m.category ?? "أزياء"} / ${m.subCategory ?? "—"}
أكثر المنتجات مبيعاً حالياً: ${m.topProducts.length ? m.topProducts.join("، ") : "—"}
${m.upcomingSeason ? `الموسم القادم: ${m.upcomingSeason}` : ""}

اكتب 10 جمل إعلانية قصيرة باللهجة السعودية العامية، كل جملة لا تتجاوز 12 كلمة، صالحة للنشر على ميتا/سناب/تيك توك/قوقل.
قواعد:
- لا إيموجي، لا علامات تعجب متعددة
- اذكر اسم المنتج أو الفئة بشكل طبيعي
- استخدم نداء سعودي مثل "يا قلبي / حياكم / لا يفوتكم / جديدنا"
- لا تذكر أسعار أو خصومات وهمية

أعد JSON فقط بهذا الشكل:
{"lines":["جملة 1","جملة 2",...,"جملة 10"]}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content[0];
  const text = block?.type === "text" ? block.text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  const parsed = JSON.parse(jsonMatch[0]) as { lines?: string[] };
  return Array.isArray(parsed.lines) ? parsed.lines.filter((l) => typeof l === "string").slice(0, 10) : [];
}

export async function runDailyCopyCycle(): Promise<{ merchants: number; generated: number }> {
  const merchants = await db
    .select({
      id: merchantsTable.id,
      storeName: merchantsTable.storeName,
      category: merchantsTable.category,
      subCategory: merchantsTable.subCategory,
    })
    .from(merchantsTable)
    .where(eq(merchantsTable.status, "active"));

  let generated = 0;
  for (const m of merchants) {
    try {
      const summary = await buildMerchantSummary(m.id, m.storeName, m.category, m.subCategory);
      const lines = await generateLines(summary);
      if (lines.length === 0) continue;
      await db.insert(aiDecisionsTable).values({
        merchantId: m.id,
        decisionType: "daily_copy",
        reasonArabic: `جهّزت لك ${lines.length} جملة إعلانية لاستخدامها اليوم على حملاتك.`,
        params: { lines, generatedAt: new Date().toISOString() },
      });
      generated++;
    } catch (err) {
      logger.error({ err: (err as Error).message, merchantId: m.id }, "daily copy generation failed");
    }
  }
  return { merchants: merchants.length, generated };
}

let timer: NodeJS.Timeout | null = null;

function msUntilNextRiyadh7am(): number {
  const now = new Date();
  // Riyadh = UTC+3, so 7am Riyadh = 4am UTC
  const target = new Date(now);
  target.setUTCHours(4, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - now.getTime();
}

export function startDailyCopy(): void {
  if (timer) return;
  if (process.env.NODE_ENV === "test") return;
  if (process.env.DISABLE_DAILY_COPY === "true") return;

  const schedule = () => {
    const ms = msUntilNextRiyadh7am();
    timer = setTimeout(async () => {
      try {
        const r = await runDailyCopyCycle();
        logger.info(r, "daily copy cycle complete");
      } catch (err) {
        logger.error({ err: (err as Error).message }, "daily copy cycle failed");
      }
      schedule(); // re-arm for next day
    }, ms);
    logger.info({ ms, fireAt: new Date(Date.now() + ms).toISOString() }, "daily copy scheduled");
  };
  schedule();
}
