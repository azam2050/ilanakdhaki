import { pgTable, varchar, uuid, timestamp, index } from "drizzle-orm/pg-core";

export const adminUsersTable = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 256 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 256 }),
    role: varchar("role", { length: 16 }).notNull().default("employee"),
    inviteToken: varchar("invite_token", { length: 128 }),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_users_email_idx").on(t.email)],
);

export type AdminUser = typeof adminUsersTable.$inferSelect;

export const adminSessionsTable = pgTable(
  "admin_sessions",
  {
    token: varchar("token", { length: 128 }).primaryKey(),
    adminUserId: uuid("admin_user_id").notNull(),
    role: varchar("role", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("admin_sessions_user_idx").on(t.adminUserId)],
);

export type AdminSession = typeof adminSessionsTable.$inferSelect;

export const adminActivityTable = pgTable(
  "admin_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id"),
    actorEmail: varchar("actor_email", { length: 256 }),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 32 }),
    targetId: varchar("target_id", { length: 128 }),
    summary: varchar("summary", { length: 512 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_activity_occurred_idx").on(t.occurredAt)],
);

export type AdminActivity = typeof adminActivityTable.$inferSelect;
