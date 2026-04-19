import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Raw merchant events (purchase, add_to_cart, view, abandoned_cart, customer_signup).
 * The product spec calls for native PostgreSQL date partitioning for performance — drizzle-kit
 * does not yet manage PARTITION BY, so we currently use BTREE indexes on (merchant_id, occurred_at)
 * and (occurred_at). When data volume requires it, switch to a native partitioned parent table
 * via a manual migration.
 */
export const networkEventsTable = pgTable(
  "network_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").notNull(),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    customerEmailHash: varchar("customer_email_hash", { length: 64 }),
    customerPhoneHash: varchar("customer_phone_hash", { length: 64 }),
    city: varchar("city", { length: 128 }),
    district: varchar("district", { length: 128 }),
    orderValue: numeric("order_value", { precision: 12, scale: 2 }),
    productCategory: varchar("product_category", { length: 64 }),
    subCategory: varchar("sub_category", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("net_events_merchant_occurred_idx").on(t.merchantId, t.occurredAt),
    index("net_events_occurred_idx").on(t.occurredAt),
    index("net_events_type_idx").on(t.eventType),
    index("net_events_subcategory_idx").on(t.subCategory),
  ],
);

export type NetworkEvent = typeof networkEventsTable.$inferSelect;
