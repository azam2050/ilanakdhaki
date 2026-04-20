import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const adLibraryItemsTable = pgTable(
  "ad_library_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").notNull(),
    fileName: varchar("file_name", { length: 256 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    fileSize: integer("file_size").notNull(),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url"),
    kind: varchar("kind", { length: 16 }).notNull().default("image"),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    aiAnalysis: jsonb("ai_analysis").$type<{
      headline_arabic?: string;
      summary_arabic?: string;
      tags?: string[];
      mood?: string;
      suggested_caption?: string;
      score?: number;
    } | null>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ad_library_merchant_idx").on(t.merchantId, t.createdAt)],
);

export type AdLibraryItem = typeof adLibraryItemsTable.$inferSelect;
