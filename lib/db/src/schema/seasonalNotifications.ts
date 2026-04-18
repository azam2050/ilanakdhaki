import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const seasonalNotificationsTable = pgTable("seasonal_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),
  seasonName: varchar("season_name", { length: 64 }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  campaignCreated: boolean("campaign_created").notNull().default(false),
});

export type SeasonalNotification =
  typeof seasonalNotificationsTable.$inferSelect;
