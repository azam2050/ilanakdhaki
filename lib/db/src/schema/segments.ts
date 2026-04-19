import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const segmentsTable = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull().unique(), // عبايات_كلاسيك
  displayName: varchar("display_name", { length: 128 }).notNull(),
  parentCategory: varchar("parent_category", { length: 64 }).notNull(),
  totalMerchants: integer("total_merchants").notNull().default(0),
  totalBuyers: integer("total_buyers").notNull().default(0),
  avgOrderValue: numeric("avg_order_value", { precision: 12, scale: 2 }),
  avgCpo: numeric("avg_cpo", { precision: 12, scale: 2 }),
  bestPlatform: varchar("best_platform", { length: 32 }),
  bestTime: varchar("best_time", { length: 32 }),
  topCities: jsonb("top_cities").$type<
    Array<{ city: string; share: number }>
  >(),
  peakSeasons: jsonb("peak_seasons").$type<string[]>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Segment = typeof segmentsTable.$inferSelect;
