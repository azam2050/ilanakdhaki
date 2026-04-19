import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const seasonalAlertsTable = pgTable("seasonal_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  nameArabic: varchar("name_arabic", { length: 128 }).notNull(),
  triggerDaysBefore: integer("trigger_days_before").notNull(),
  targetCategories: jsonb("target_categories").$type<string[]>(),
  triggerDate: timestamp("trigger_date", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SeasonalAlert = typeof seasonalAlertsTable.$inferSelect;
