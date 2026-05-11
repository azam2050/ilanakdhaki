import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Content generation tasks (linked to Manus API tasks) ───────────────────
export const contentTasksTable = pgTable("content_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),

  /** Manus API task ID returned by task.create */
  manusTaskId: varchar("manus_task_id", { length: 128 }),

  /** "post" | "video" | "story" | "reel" */
  contentType: varchar("content_type", { length: 32 }).notNull(),

  /** Free-form prompt / brief the merchant provided */
  prompt: text("prompt").notNull(),

  /** "pending" | "processing" | "completed" | "failed" */
  status: varchar("status", { length: 32 }).notNull().default("pending"),

  /** Credits charged for this task */
  creditsCharged: integer("credits_charged").notNull().default(0),

  /** Error message if the task failed */
  errorMessage: text("error_message"),

  /** Raw Manus API response / messages stored for debugging */
  manusResponse: jsonb("manus_response"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertContentTaskSchema = createInsertSchema(
  contentTasksTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentTask = z.infer<typeof insertContentTaskSchema>;
export type ContentTask = typeof contentTasksTable.$inferSelect;

// ─── Generated content items (output of a content task) ─────────────────────
export const generatedContentTable = pgTable("generated_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  merchantId: uuid("merchant_id").notNull(),

  /** "text" | "image" | "video" */
  mediaType: varchar("media_type", { length: 32 }).notNull(),

  /** The generated text content (ad copy, caption, etc.) */
  textContent: text("text_content"),

  /** URL to the generated media file (image/video) */
  mediaUrl: text("media_url"),

  /** Platform target: "meta" | "snap" | "tiktok" | "google" | "all" */
  platform: varchar("platform", { length: 32 }).default("all"),

  /** Metadata: dimensions, duration, format, etc. */
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GeneratedContent = typeof generatedContentTable.$inferSelect;

// ─── Content schedules (auto-generation every 24h) ──────────────────────────
export const contentSchedulesTable = pgTable("content_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),

  /** "post" | "video" | "story" */
  contentType: varchar("content_type", { length: 32 }).notNull(),

  /** The prompt template used for auto-generation */
  promptTemplate: text("prompt_template").notNull(),

  /** Platform target */
  platform: varchar("platform", { length: 32 }).default("all"),

  /** Whether this schedule is active */
  active: boolean("active").notNull().default(true),

  /** Hour of day (Riyadh time, 0-23) to run the generation */
  runHour: integer("run_hour").notNull().default(7),

  /** Last time the schedule was executed */
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),

  /** Next scheduled run */
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ContentSchedule = typeof contentSchedulesTable.$inferSelect;

// ─── Merchant credits / balance tracking ────────────────────────────────────
export const merchantCreditsTable = pgTable("merchant_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),

  /** Current balance */
  balance: integer("balance").notNull().default(0),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type MerchantCredits = typeof merchantCreditsTable.$inferSelect;

// ─── Credit transactions log ────────────────────────────────────────────────
export const creditTransactionsTable = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id").notNull(),

  /** "charge" | "refund" | "topup" */
  type: varchar("type", { length: 32 }).notNull(),

  /** Positive for topup/refund, negative for charge */
  amount: integer("amount").notNull(),

  /** Balance after this transaction */
  balanceAfter: integer("balance_after").notNull(),

  /** Reference to the content task if applicable */
  contentTaskId: uuid("content_task_id"),

  description: text("description"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
