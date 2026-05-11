/**
 * Manus Webhook Handler
 * ─────────────────────
 * POST /api/webhooks/manus
 *
 * Receives task_created and task_stopped events from Manus API.
 * Updates content task status and stores generated content.
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  contentTasksTable,
  generatedContentTable,
} from "@workspace/db";
import { getManusTaskMessages } from "../../lib/manusClient";
import { addCredits } from "../../lib/creditsService";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

interface ManusWebhookBody {
  event: string;
  task_id: string;
  status?: string;
  data?: Record<string, unknown>;
}

router.post("/webhooks/manus", async (req, res) => {
  try {
    const body = req.body as ManusWebhookBody;

    if (!body || !body.event || !body.task_id) {
      logger.warn({ body }, "manus_webhook_invalid_payload");
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    logger.info(
      { event: body.event, taskId: body.task_id },
      "manus_webhook_received",
    );

    // Find the content task by Manus task ID
    const [task] = await db
      .select()
      .from(contentTasksTable)
      .where(eq(contentTasksTable.manusTaskId, body.task_id))
      .limit(1);

    if (!task) {
      logger.warn(
        { manusTaskId: body.task_id },
        "manus_webhook_task_not_found",
      );
      // Still return 200 to acknowledge receipt
      res.status(200).json({ received: true, matched: false });
      return;
    }

    switch (body.event) {
      case "task_created": {
        // Task was created on Manus side — update status if still pending
        if (task.status === "pending") {
          await db
            .update(contentTasksTable)
            .set({ status: "processing" })
            .where(eq(contentTasksTable.id, task.id));
        }
        break;
      }

      case "task_stopped":
      case "task_completed": {
        // Task completed — fetch messages and extract content
        try {
          const messages = await getManusTaskMessages(body.task_id);

          const assistantMessages = messages.messages.filter(
            (m) => m.role === "assistant",
          );
          const lastMessage =
            assistantMessages[assistantMessages.length - 1];

          if (lastMessage) {
            // Try to parse structured JSON content
            let parsedContent: Record<string, unknown> | null = null;
            try {
              const jsonMatch = lastMessage.content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsedContent = JSON.parse(jsonMatch[0]);
              }
            } catch {
              // Not JSON — use as plain text
            }

            // Save generated content
            await db.insert(generatedContentTable).values({
              taskId: task.id,
              merchantId: task.merchantId,
              mediaType:
                task.contentType === "video" || task.contentType === "reel"
                  ? "video"
                  : "text",
              textContent: parsedContent
                ? JSON.stringify(parsedContent)
                : lastMessage.content,
              platform: "all",
              metadata: parsedContent ?? { rawText: lastMessage.content },
            });

            // Check for image URLs in the response
            const imageUrlPattern =
              /https?:\/\/[^\s"']+\.(png|jpg|jpeg|gif|webp)/gi;
            const imageUrls = lastMessage.content.match(imageUrlPattern);
            if (imageUrls) {
              for (const url of imageUrls) {
                await db.insert(generatedContentTable).values({
                  taskId: task.id,
                  merchantId: task.merchantId,
                  mediaType: "image",
                  mediaUrl: url,
                  platform: "all",
                  metadata: { source: "manus_generated" },
                });
              }
            }
          }

          // Update task as completed
          await db
            .update(contentTasksTable)
            .set({
              status: "completed",
              manusResponse: messages as unknown as Record<string, unknown>,
              completedAt: new Date(),
            })
            .where(eq(contentTasksTable.id, task.id));

          logger.info(
            { taskId: task.id, manusTaskId: body.task_id },
            "manus_task_completed",
          );
        } catch (err) {
          logger.error(
            {
              err: (err as Error).message,
              taskId: task.id,
            },
            "manus_webhook_fetch_messages_error",
          );

          // Mark as completed anyway since Manus says it's done
          await db
            .update(contentTasksTable)
            .set({
              status: "completed",
              completedAt: new Date(),
            })
            .where(eq(contentTasksTable.id, task.id));
        }
        break;
      }

      case "task_failed": {
        // Task failed on Manus side — refund credits
        const errorMsg =
          typeof body.data?.error === "string"
            ? body.data.error
            : "فشلت المهمة على خدمة Manus";

        await db
          .update(contentTasksTable)
          .set({
            status: "failed",
            errorMessage: errorMsg,
          })
          .where(eq(contentTasksTable.id, task.id));

        // Refund credits
        if (task.creditsCharged > 0) {
          await addCredits({
            merchantId: task.merchantId,
            amount: task.creditsCharged,
            type: "refund",
            contentTaskId: task.id,
            description: "استرداد رصيد - فشل توليد المحتوى",
          });
        }

        logger.info(
          { taskId: task.id, error: errorMsg },
          "manus_task_failed",
        );
        break;
      }

      default:
        logger.info(
          { event: body.event, taskId: body.task_id },
          "manus_webhook_unknown_event",
        );
    }

    res.status(200).json({ received: true, matched: true });
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "manus_webhook_handler_error",
    );
    // Always return 200 to prevent retries
    res.status(200).json({ received: true, error: "internal" });
  }
});

export default router;
