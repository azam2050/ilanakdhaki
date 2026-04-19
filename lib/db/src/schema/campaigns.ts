import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const campaignsTable = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),
  adAccountId: uuid("ad_account_id"),
  platform: varchar("platform", { length: 32 }).notNull(),
  campaignIdExternal: varchar("campaign_id_external", { length: 128 }),
  name: varchar("name", { length: 255 }),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  dailyBudget: numeric("daily_budget", { precision: 12, scale: 2 }),
  spentToday: numeric("spent_today", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  ordersToday: integer("orders_today").notNull().default(0),
  costPerOrder: numeric("cost_per_order", { precision: 12, scale: 2 }),
  roas: numeric("roas", { precision: 8, scale: 2 }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Campaign = typeof campaignsTable.$inferSelect;
