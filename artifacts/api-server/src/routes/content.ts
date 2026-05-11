/**
 * Content Generation Routes
 * ─────────────────────────
 * POST /api/content/generate     - Request content generation
 * GET  /api/content/status/:taskId - Check generation status
 * GET  /api/content/list         - List generated content
 * POST /api/content/schedule     - Create/update auto-generation schedule
 * GET  /api/content/schedules    - List active schedules
 * DELETE /api/content/schedule/:id - Remove a schedule
 * GET  /api/content/credits      - Get credit balance & history
 */

import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  db,
  contentTasksTable,
  generatedContentTable,
  contentSchedulesTable,
  merchantsTable,
} from "@workspace/db";
import { requireSession } from "../middlewares/requireSession";
import {
  createManusTask,
  getManusTaskMessages,
  buildContentPrompt,
  CONTENT_OUTPUT_SCHEMA,
  CONTENT_CREDITS_COST,
  ManusApiError,
} from "../lib/manusClient";
import {
  chargeCredits,
  getBalance,
  getTransactionHistory,
  hasEnoughCredits,
  InsufficientCreditsError,
} from "../lib/creditsService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── POST /content/generate ─────────────────────────────────────────────────

router.post("/content/generate", requireSession, async (req, res) => {
  try {
    const merchant = req.merchant!;
    const {
      contentType = "post",
      prompt,
      platform = "all",
    } = req.body as {
      contentType?: string;
      prompt?: string;
      platform?: string;
    };

    // Validate content type
    const validTypes = ["post", "video", "story", "reel"];
    if (!validTypes.includes(contentType)) {
      res.status(400).json({
        error: `نوع المحتوى غير صالح. الأنواع المتاحة: ${validTypes.join(", ")}`,
      });
      return;
    }

    if (!prompt || prompt.trim().length < 5) {
      res.status(400).json({
        error: "يرجى إدخال وصف للمحتوى المطلوب (5 أحرف على الأقل)",
      });
      return;
    }

    // Check credits
    const cost = CONTENT_CREDITS_COST[contentType] ?? 5;
    const enough = await hasEnoughCredits(merchant.id, cost);
    if (!enough) {
      const balance = await getBalance(merchant.id);
      res.status(402).json({
        error: "رصيدك غير كافٍ لتوليد هذا المحتوى",
        required: cost,
        available: balance,
      });
      return;
    }

    // Build the prompt
    const fullPrompt = buildContentPrompt({
      storeName: merchant.storeName,
      category: merchant.category,
      contentType,
      platform,
      customPrompt: prompt,
    });

    // Create the content task record
    const [task] = await db
      .insert(contentTasksTable)
      .values({
        merchantId: merchant.id,
        contentType,
        prompt: prompt.trim(),
        status: "pending",
        creditsCharged: cost,
      })
      .returning();

    // Charge credits
    try {
      await chargeCredits({
        merchantId: merchant.id,
        amount: cost,
        contentTaskId: task.id,
        description: `توليد ${contentType === "post" ? "بوست" : contentType === "video" ? "فيديو" : contentType === "story" ? "ستوري" : "ريلز"} إعلاني`,
      });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        // Clean up the task
        await db
          .delete(contentTasksTable)
          .where(eq(contentTasksTable.id, task.id));
        res.status(402).json({
          error: "رصيدك غير كافٍ",
          required: cost,
          available: err.available,
        });
        return;
      }
      throw err;
    }

    // Build webhook URL
    const baseUrl =
      process.env.APP_BASE_URL ?? "https://ilanakdhaki.com";
    const webhookUrl = `${baseUrl}/api/webhooks/manus`;

    // Call Manus API
    try {
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

      res.status(201).json({
        taskId: task.id,
        manusTaskId: manusResponse.task_id,
        status: "processing",
        contentType,
        creditsCharged: cost,
        message: "تم إرسال طلب توليد المحتوى بنجاح. يمكنك متابعة الحالة.",
      });
    } catch (err) {
      // If Manus API fails, refund credits and mark task as failed
      const errorMessage =
        err instanceof ManusApiError
          ? err.responseBody
          : (err as Error).message;

      await db
        .update(contentTasksTable)
        .set({
          status: "failed",
          errorMessage: `فشل الاتصال بـ Manus API: ${errorMessage}`,
        })
        .where(eq(contentTasksTable.id, task.id));

      // Refund credits
      const { addCredits } = await import("../lib/creditsService");
      await addCredits({
        merchantId: merchant.id,
        amount: cost,
        type: "refund",
        contentTaskId: task.id,
        description: "استرداد رصيد - فشل توليد المحتوى",
      });

      logger.error(
        { err: errorMessage, taskId: task.id },
        "manus_task_create_failed",
      );

      res.status(502).json({
        error: "فشل الاتصال بخدمة توليد المحتوى. تم استرداد الرصيد.",
        taskId: task.id,
      });
    }
  } catch (err) {
    logger.error({ err: (err as Error).message }, "content_generate_error");
    res.status(500).json({ error: "حدث خطأ داخلي" });
  }
});

// ─── GET /content/status/:taskId ────────────────────────────────────────────

router.get("/content/status/:taskId", requireSession, async (req, res) => {
  try {
    const merchant = req.merchant!;
    const { taskId } = req.params;

    const [task] = await db
      .select()
      .from(contentTasksTable)
      .where(
        and(
          eq(contentTasksTable.id, taskId),
          eq(contentTasksTable.merchantId, merchant.id),
        ),
      )
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "المهمة غير موجودة" });
      return;
    }

    // If still processing and has a Manus task ID, poll for updates
    if (task.status === "processing" && task.manusTaskId) {
      try {
        const messages = await getManusTaskMessages(task.manusTaskId);

        if (
          messages.status === "completed" ||
          messages.status === "stopped"
        ) {
          // Extract content from the last assistant message
          const assistantMessages = messages.messages.filter(
            (m) => m.role === "assistant",
          );
          const lastMessage =
            assistantMessages[assistantMessages.length - 1];

          if (lastMessage) {
            // Try to parse structured content
            let parsedContent: Record<string, unknown> | null = null;
            try {
              const jsonMatch = lastMessage.content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsedContent = JSON.parse(jsonMatch[0]);
              }
            } catch {
              // Not JSON, use as plain text
            }

            // Save generated content
            await db.insert(generatedContentTable).values({
              taskId: task.id,
              merchantId: merchant.id,
              mediaType: task.contentType === "video" || task.contentType === "reel" ? "video" : "text",
              textContent: parsedContent
                ? JSON.stringify(parsedContent)
                : lastMessage.content,
              platform: "all",
              metadata: parsedContent ?? { rawText: lastMessage.content },
            });

            // Update task status
            await db
              .update(contentTasksTable)
              .set({
                status: "completed",
                manusResponse: messages as unknown as Record<string, unknown>,
                completedAt: new Date(),
              })
              .where(eq(contentTasksTable.id, task.id));

            // Return updated status
            const content = await db
              .select()
              .from(generatedContentTable)
              .where(eq(generatedContentTable.taskId, task.id));

            res.json({
              taskId: task.id,
              status: "completed",
              contentType: task.contentType,
              creditsCharged: task.creditsCharged,
              content,
              completedAt: new Date().toISOString(),
            });
            return;
          }
        }

        // Still processing
        res.json({
          taskId: task.id,
          status: "processing",
          contentType: task.contentType,
          creditsCharged: task.creditsCharged,
          manusStatus: messages.status,
          messageCount: messages.messages.length,
        });
        return;
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, taskId: task.id },
          "manus_poll_error",
        );
        // Return current status without polling
      }
    }

    // Return stored status
    const content =
      task.status === "completed"
        ? await db
            .select()
            .from(generatedContentTable)
            .where(eq(generatedContentTable.taskId, task.id))
        : [];

    res.json({
      taskId: task.id,
      status: task.status,
      contentType: task.contentType,
      creditsCharged: task.creditsCharged,
      errorMessage: task.errorMessage,
      content,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "content_status_error");
    res.status(500).json({ error: "حدث خطأ داخلي" });
  }
});

// ─── GET /content/list ──────────────────────────────────────────────────────

router.get("/content/list", requireSession, async (req, res) => {
  try {
    const merchant = req.merchant!;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const statusFilter = req.query.status as string | undefined;

    let query = db
      .select()
      .from(contentTasksTable)
      .where(
        statusFilter
          ? and(
              eq(contentTasksTable.merchantId, merchant.id),
              eq(contentTasksTable.status, statusFilter),
            )
          : eq(contentTasksTable.merchantId, merchant.id),
      )
      .orderBy(desc(contentTasksTable.createdAt))
      .limit(limit)
      .offset(offset);

    const tasks = await query;

    // Get content for completed tasks
    const completedTaskIds = tasks
      .filter((t) => t.status === "completed")
      .map((t) => t.id);

    let contentMap: Record<string, typeof generatedContentTable.$inferSelect[]> = {};
    if (completedTaskIds.length > 0) {
      const allContent = await db
        .select()
        .from(generatedContentTable)
        .where(
          sql`${generatedContentTable.taskId} IN (${sql.join(
            completedTaskIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      for (const c of allContent) {
        if (!contentMap[c.taskId]) contentMap[c.taskId] = [];
        contentMap[c.taskId].push(c);
      }
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentTasksTable)
      .where(eq(contentTasksTable.merchantId, merchant.id));

    res.json({
      tasks: tasks.map((t) => ({
        ...t,
        content: contentMap[t.id] ?? [],
      })),
      total: countResult?.count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "content_list_error");
    res.status(500).json({ error: "حدث خطأ داخلي" });
  }
});

// ─── POST /content/schedule ─────────────────────────────────────────────────

router.post("/content/schedule", requireSession, async (req, res) => {
  try {
    const merchant = req.merchant!;
    const {
      contentType = "post",
      promptTemplate,
      platform = "all",
      runHour = 7,
      active = true,
    } = req.body as {
      contentType?: string;
      promptTemplate?: string;
      platform?: string;
      runHour?: number;
      active?: boolean;
    };

    if (!promptTemplate || promptTemplate.trim().length < 5) {
      res.status(400).json({
        error: "يرجى إدخال قالب المحتوى (5 أحرف على الأقل)",
      });
      return;
    }

    const validTypes = ["post", "video", "story", "reel"];
    if (!validTypes.includes(contentType)) {
      res.status(400).json({
        error: `نوع المحتوى غير صالح. الأنواع المتاحة: ${validTypes.join(", ")}`,
      });
      return;
    }

    if (runHour < 0 || runHour > 23) {
      res.status(400).json({ error: "ساعة التشغيل يجب أن تكون بين 0 و 23" });
      return;
    }

    // Calculate next run time (Riyadh time)
    const now = new Date();
    const riyadhOffset = 3 * 60 * 60 * 1000;
    const riyadhNow = new Date(now.getTime() + riyadhOffset);
    const nextRun = new Date(riyadhNow);
    nextRun.setUTCHours(runHour, 0, 0, 0);
    if (nextRun.getTime() <= riyadhNow.getTime()) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
    // Convert back to UTC
    const nextRunUtc = new Date(nextRun.getTime() - riyadhOffset);

    const [schedule] = await db
      .insert(contentSchedulesTable)
      .values({
        merchantId: merchant.id,
        contentType,
        promptTemplate: promptTemplate.trim(),
        platform,
        active,
        runHour,
        nextRunAt: nextRunUtc,
      })
      .returning();

    res.status(201).json({
      schedule,
      message: "تم إنشاء جدولة توليد المحتوى بنجاح",
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "content_schedule_error");
    res.status(500).json({ error: "حدث خطأ داخلي" });
  }
});

// ─── GET /content/schedules ─────────────────────────────────────────────────

router.get("/content/schedules", requireSession, async (req, res) => {
  try {
    const merchant = req.merchant!;

    const schedules = await db
      .select()
      .from(contentSchedulesTable)
      .where(eq(contentSchedulesTable.merchantId, merchant.id))
      .orderBy(desc(contentSchedulesTable.createdAt));

    res.json({ schedules });
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "content_schedules_list_error",
    );
    res.status(500).json({ error: "حدث خطأ داخلي" });
  }
});

// ─── DELETE /content/schedule/:id ───────────────────────────────────────────

router.delete("/content/schedule/:id", requireSession, async (req, res) => {
  try {
    const merchant = req.merchant!;
    const { id } = req.params;

    const result = await db
      .delete(contentSchedulesTable)
      .where(
        and(
          eq(contentSchedulesTable.id, id),
          eq(contentSchedulesTable.merchantId, merchant.id),
        ),
      )
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "الجدولة غير موجودة" });
      return;
    }

    res.json({ message: "تم حذف الجدولة بنجاح" });
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "content_schedule_delete_error",
    );
    res.status(500).json({ error: "حدث خطأ داخلي" });
  }
});

// ─── PATCH /content/schedule/:id ────────────────────────────────────────────

router.patch("/content/schedule/:id", requireSession, async (req, res) => {
  try {
    const merchant = req.merchant!;
    const { id } = req.params;
    const { active, promptTemplate, runHour } = req.body as {
      active?: boolean;
      promptTemplate?: string;
      runHour?: number;
    };

    const updates: Record<string, unknown> = {};
    if (typeof active === "boolean") updates.active = active;
    if (promptTemplate) updates.promptTemplate = promptTemplate.trim();
    if (typeof runHour === "number" && runHour >= 0 && runHour <= 23) {
      updates.runHour = runHour;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "لا توجد بيانات للتحديث" });
      return;
    }

    const result = await db
      .update(contentSchedulesTable)
      .set(updates)
      .where(
        and(
          eq(contentSchedulesTable.id, id),
          eq(contentSchedulesTable.merchantId, merchant.id),
        ),
      )
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "الجدولة غير موجودة" });
      return;
    }

    res.json({ schedule: result[0], message: "تم تحديث الجدولة بنجاح" });
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "content_schedule_update_error",
    );
    res.status(500).json({ error: "حدث خطأ داخلي" });
  }
});

// ─── GET /content/credits ───────────────────────────────────────────────────

router.get("/content/credits", requireSession, async (req, res) => {
  try {
    const merchant = req.merchant!;
    const balance = await getBalance(merchant.id);
    const transactions = await getTransactionHistory(merchant.id, 20);

    res.json({
      balance,
      costs: CONTENT_CREDITS_COST,
      transactions,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "content_credits_error");
    res.status(500).json({ error: "حدث خطأ داخلي" });
  }
});

export default router;
