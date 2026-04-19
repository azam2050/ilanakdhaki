import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const segmentAudiencesTable = pgTable("segment_audiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  segmentId: uuid("segment_id").notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  audienceIdExternal: varchar("audience_id_external", { length: 128 }),
  audienceSize: integer("audience_size").notNull().default(0),
  lastRefreshed: timestamp("last_refreshed", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SegmentAudience = typeof segmentAudiencesTable.$inferSelect;
