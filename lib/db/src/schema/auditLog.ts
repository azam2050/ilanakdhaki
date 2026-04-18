import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const auditLogTable = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id"),
    action: varchar("action", { length: 64 }).notNull(),
    details: jsonb("details").$type<Record<string, unknown> | null>(),
    ipAddress: varchar("ip_address", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_merchant_occurred_idx").on(t.merchantId, t.occurredAt)],
);

export type AuditLogEntry = typeof auditLogTable.$inferSelect;
