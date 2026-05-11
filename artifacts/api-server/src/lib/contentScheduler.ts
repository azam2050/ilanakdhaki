/**
 * Content Scheduler
 * ─────────────────
 * Runs scheduled content generation tasks every hour.
 * Checks for schedules whose nextRunAt has passed and triggers generation.
 */

import { eq, and, lte, sql } from "drizzle-orm";
import {
  db,
  contentSchedulesTable,
  contentTasksTable,
  merchantsTable,
} from "@workspace/db";
import {
  createManusTask,
  buildContentPrompt,
  CONTENT_OUTPUT_SCHEMA,
  CONTENT_CREDITS_COST,
} from "./manusClient";
import { chargeCredits, hasEnoughCredits } from "./creditsService";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

/**
 * Process all due schedules.
 */
export async function runScheduledContentCycle(): Promise<{
  processed: number;
  generated: number;
  skipped: number;
}> {
  const now = new Date();

  // Find all active schedules whose nextRunAt has passed
  const dueSchedules = await db
    .select({
      schedule: contentSchedulesTable,
      merchant: merchantsTable,
    })
    .from(contentSchedulesTable)
    .innerJoin(
      merchantsTable,
      eq(merchantsTable.id, contentSchedulesTable.merchantId),
    )
    .where(
      and(
        eq(contentSchedulesTable.active, true),
        lte(contentSchedulesTable.nextRunAt, now),
      ),
    );

  let generated = 0;
  let skipped = 0;

  for (const { schedule, merchant } of dueSchedules) {
    try {
      const cost = CONTENT_CREDITS_COST[schedule.contentType] ?? 5;

      // Check if merchant has enough credits
      const enough = await hasEnoughCredits(merchant.id, cost);
      if (!enough) {
        logger.warn(
          {
            merchantId: merchant.id,
            scheduleId: schedule.id,
            cost,
          },
          "scheduled_content_insufficient_credits",
        );
        skipped++;

        // Still advance nextRunAt to avoid retrying immediately
        await advanceNextRun(schedule.id, schedule.runHour);
        continue;
      }

      // Build prompt
      const fullPrompt = buildContentPrompt({
        storeName: merchant.storeName,
        category: merchant.category,
        contentType: schedule.contentType,
        platform: schedule.platform ?? "all",
        customPrompt: schedule.promptTemplate,
      });

      // Create content task record
      const [task] = await db
        .insert(contentTasksTable)
        .values({
          merchantId: merchant.id,
          contentType: schedule.contentType,
          prompt: schedule.promptTemplate,
          status: "pending",
          creditsCharged: cost,
        })
        .returning();

      // Charge credits
      await chargeCredits({
        merchantId: merchant.id,
        amount: cost,
        contentTaskId: task.id,
        description: `توليد ${schedule.contentType} مجدول تلقائياً`,
      });

      // Build webhook URL
      const baseUrl =
        process.env.APP_BASE_URL ?? "https://ilanakdhaki.com";
      const webhookUrl = `${baseUrl}/api/webhooks/manus`;

      // Call Manus API
      const manusResponse = await createManusTask({
        prompt: fullPrompt,
        structuredOutputSchema: CONTENT_OUTPUT_SCHEMA,
        webhookUrl,
      });

      // Update task with Manus task ID
      await db
        .update(contentTasksTable)
        .set({
          manusTaskId: manusResponse.task_id,
          status: "processing",
        })
        .where(eq(contentTasksTable.id, task.id));

      // Update schedule: lastRunAt and advance nextRunAt
      await db
        .update(contentSchedulesTable)
        .set({
          lastRunAt: now,
        })
        .where(eq(contentSchedulesTable.id, schedule.id));

      await advanceNextRun(schedule.id, schedule.runHour);

      generated++;
      logger.info(
        {
          scheduleId: schedule.id,
          merchantId: merchant.id,
          taskId: task.id,
          manusTaskId: manusResponse.task_id,
        },
        "scheduled_content_generated",
      );
    } catch (err) {
      logger.error(
        {
          err: (err as Error).message,
          scheduleId: schedule.id,
          merchantId: merchant.id,
        },
        "scheduled_content_error",
      );
      skipped++;

      // Advance nextRunAt even on error to avoid infinite retry
      await advanceNextRun(schedule.id, schedule.runHour).catch(() => {});
    }
  }

  return { processed: dueSchedules.length, generated, skipped };
}

/**
 * Advance the nextRunAt to the next day at the specified hour (Riyadh time).
 */
async function advanceNextRun(
  scheduleId: string,
  runHour: number,
): Promise<void> {
  const riyadhOffset = 3 * 60 * 60 * 1000;
  const now = new Date();
  const riyadhNow = new Date(now.getTime() + riyadhOffset);

  const nextRun = new Date(riyadhNow);
  nextRun.setUTCHours(runHour, 0, 0, 0);
  // Always go to next day
  nextRun.setUTCDate(nextRun.getUTCDate() + 1);

  // Convert back to UTC
  const nextRunUtc = new Date(nextRun.getTime() - riyadhOffset);

  await db
    .update(contentSchedulesTable)
    .set({ nextRunAt: nextRunUtc })
    .where(eq(contentSchedulesTable.id, scheduleId));
}

// ─── Scheduler loop ─────────────────────────────────────────────────────────

let timer: NodeJS.Timeout | null = null;

export function startContentScheduler(): void {
  if (timer) return;
  if (process.env.NODE_ENV === "test") return;
  if (process.env.DISABLE_CONTENT_SCHEDULER === "true") return;

  const run = async () => {
    try {
      const result = await runScheduledContentCycle();
      if (result.processed > 0) {
        logger.info(result, "content_scheduler_cycle_complete");
      }
    } catch (err) {
      logger.error(
        { err: (err as Error).message },
        "content_scheduler_cycle_failed",
      );
    }
  };

  // Run immediately on start, then every hour
  run();
  timer = setInterval(run, CHECK_INTERVAL_MS);

  logger.info(
    { intervalMs: CHECK_INTERVAL_MS },
    "content_scheduler_started",
  );
}

export function stopContentScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info("content_scheduler_stopped");
  }
}
