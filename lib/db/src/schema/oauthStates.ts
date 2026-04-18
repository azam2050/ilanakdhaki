import { pgTable, varchar, timestamp, text } from "drizzle-orm/pg-core";

export const oauthStatesTable = pgTable("oauth_states", {
  state: varchar("state", { length: 128 }).primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull(),
  redirectTo: text("redirect_to"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type OAuthState = typeof oauthStatesTable.$inferSelect;
