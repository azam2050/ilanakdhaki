import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const merchantsTable = pgTable("merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  sallaMerchantId: varchar("salla_merchant_id", { length: 64 }).unique(),
  zidMerchantId: varchar("zid_merchant_id", { length: 64 }).unique(),
  storeName: varchar("store_name", { length: 255 }).notNull(),
  storeDomain: varchar("store_domain", { length: 255 }),
  ownerEmail: varchar("owner_email", { length: 255 }),
  ownerPhone: varchar("owner_phone", { length: 64 }),
  category: varchar("category", { length: 64 }),
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  tokenScope: text("token_scope"),
  plan: varchar("plan", { length: 32 }).notNull().default("trial"),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  consents: jsonb("consents")
    .$type<{
      readStoreData: boolean;
      receiveWebhooks: boolean;
      shareAudienceNetwork: boolean;
      manageAdAccounts: boolean;
      acceptedAt: string;
    } | null>()
    .default(null),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertMerchantSchema = createInsertSchema(merchantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
export type Merchant = typeof merchantsTable.$inferSelect;
