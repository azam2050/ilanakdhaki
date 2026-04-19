import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const aiDecisionsTable = pgTable(
  "ai_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").notNull(),
    campaignId: uuid("campaign_id"),
    decisionType: varchar("decision_type", { length: 64 }).notNull(),
    reasonArabic: text("reason_arabic").notNull(),
    resultArabic: text("result_arabic"),
    params: jsonb("params").$type<Record<string, unknown> | null>(),
    executedAt: timestamp("executed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_decisions_merchant_executed_idx").on(t.merchantId, t.executedAt)],
);

export type AiDecision = typeof aiDecisionsTable.$inferSelect;
