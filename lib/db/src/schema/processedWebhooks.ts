import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const processedWebhooksTable = pgTable("processed_webhooks", {
  id: varchar("id", { length: 128 }).primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProcessedWebhook = typeof processedWebhooksTable.$inferSelect;
