import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Per-merchant connections to ad platforms (Meta, Snap, TikTok, Google).
 * Tokens are stored AES-256-GCM encrypted via lib/crypto in api-server.
 */
export const adAccountsTable = pgTable(
  "ad_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").notNull(),
    platform: varchar("platform", { length: 32 }).notNull(), // meta|snap|tiktok|google
    accountIdExternal: varchar("account_id_external", { length: 128 }).notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    pixelId: varchar("pixel_id", { length: 128 }),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("ad_accounts_merchant_platform_account_uniq").on(
      t.merchantId,
      t.platform,
      t.accountIdExternal,
    ),
  ],
);

export type AdAccount = typeof adAccountsTable.$inferSelect;
