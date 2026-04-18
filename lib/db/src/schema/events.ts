import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const eventsTable = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").notNull(),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    customerEmailHash: varchar("customer_email_hash", { length: 64 }),
    customerPhoneHash: varchar("customer_phone_hash", { length: 64 }),
    city: varchar("city", { length: 128 }),
    orderValue: numeric("order_value", { precision: 12, scale: 2 }),
    productCategory: varchar("product_category", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("events_merchant_occurred_idx").on(t.merchantId, t.occurredAt),
    index("events_type_idx").on(t.eventType),
  ],
);

export type AdEvent = typeof eventsTable.$inferSelect;
