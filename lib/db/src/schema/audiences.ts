import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const audiencesTable = pgTable("audiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  audienceIdExternal: varchar("audience_id_external", { length: 128 }),
  audienceType: varchar("audience_type", { length: 32 }).notNull(),
  size: integer("size").notNull().default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Audience = typeof audiencesTable.$inferSelect;
