import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const adCreativesTable = pgTable("ad_creatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),
  headline: text("headline"),
  body: text("body"),
  cta: varchar("cta", { length: 64 }),
  imageUrl: text("image_url"),
  aiGenerated: boolean("ai_generated").notNull().default(true),
  performanceScore: numeric("performance_score", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AdCreative = typeof adCreativesTable.$inferSelect;
