import { Router, type IRouter } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, adLibraryItemsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireSession } from "../middlewares/requireSession";
import {
  isStorageConfigured,
  uploadObject,
  deleteObject,
  publicUrlFor,
  getSignedDownloadUrl,
} from "../lib/storage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

const ALLOWED_IMAGE = /^image\/(jpeg|jpg|png|webp|gif)$/i;
const ALLOWED_VIDEO = /^video\/(mp4|quicktime|webm)$/i;

router.get("/ad-library", requireSession, async (req, res) => {
  const m = req.merchant!;
  const rows = await db
    .select()
    .from(adLibraryItemsTable)
    .where(eq(adLibraryItemsTable.merchantId, m.id))
    .orderBy(desc(adLibraryItemsTable.createdAt))
    .limit(100);

  const items = await Promise.all(
    rows.map(async (r) => {
      let viewUrl = r.publicUrl;
      if (!viewUrl && isStorageConfigured()) {
        try {
          viewUrl = await getSignedDownloadUrl(r.storageKey, 3600);
        } catch {
          viewUrl = null;
        }
      }
      return {
        id: r.id,
        fileName: r.fileName,
        mimeType: r.mimeType,
        fileSize: r.fileSize,
        kind: r.kind,
        status: r.status,
        viewUrl,
        aiAnalysis: r.aiAnalysis ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    }),
  );

  res.json({ items, storageConfigured: isStorageConfigured() });
});

router.post("/ad-library", requireSession, upload.single("file"), async (req, res) => {
  if (!isStorageConfigured()) {
    res.status(503).json({ error: "storage_not_configured" });
    return;
  }
  const m = req.merchant!;
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "no_file" });
    return;
  }
  const isImage = ALLOWED_IMAGE.test(file.mimetype);
  const isVideo = ALLOWED_VIDEO.test(file.mimetype);
  if (!isImage && !isVideo) {
    res.status(400).json({ error: "unsupported_type" });
    return;
  }

  const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
  const key = `merchants/${m.id}/${randomUUID()}${ext ? "." + ext : ""}`;

  try {
    await uploadObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
      contentLength: file.size,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "ad-library upload failed");
    res.status(500).json({ error: "upload_failed" });
    return;
  }

  const publicUrl = publicUrlFor(key);
  const [row] = await db
    .insert(adLibraryItemsTable)
    .values({
      merchantId: m.id,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      storageKey: key,
      publicUrl,
      kind: isImage ? "image" : "video",
      status: isImage ? "pending" : "skipped",
    })
    .returning();

  // Fire-and-forget Claude vision analysis for images
  if (isImage && row) {
    analyzeImageInBackground(row.id, file.buffer, file.mimetype).catch((err) => {
      logger.error({ err: (err as Error).message, id: row.id }, "background analyze failed");
    });
  }

  res.json({ id: row.id, status: row.status });
});

router.delete("/ad-library/:id", requireSession, async (req, res) => {
  const m = req.merchant!;
  const id = req.params.id;
  const [row] = await db
    .select()
    .from(adLibraryItemsTable)
    .where(and(eq(adLibraryItemsTable.id, id), eq(adLibraryItemsTable.merchantId, m.id)));
  if (!row) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (isStorageConfigured()) {
    try {
      await deleteObject(row.storageKey);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "delete object warn");
    }
  }
  await db.delete(adLibraryItemsTable).where(eq(adLibraryItemsTable.id, id));
  res.json({ ok: true });
});

async function analyzeImageInBackground(itemId: string, buffer: Buffer, mimeType: string): Promise<void> {
  try {
    const base64 = buffer.toString("base64");
    const mediaType = mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `حلّل هذه الصورة الإعلانية لمتجر إلكتروني سعودي. أجب بـ JSON فقط بهذا الشكل، عربية فصحى بسيطة:
{
  "headline_arabic": "عنوان جذاب من ٤-٧ كلمات",
  "summary_arabic": "وصف الصورة بجملة واحدة",
  "tags": ["وسم١", "وسم٢", "وسم٣"],
  "mood": "نمط الصورة (مشرق/فاخر/شبابي/...)",
  "suggested_caption": "نص إعلاني مقترح من ٢٠-٣٠ كلمة بالعربي السعودي",
  "score": رقم من 1 إلى 10 يقيّم جودة الصورة كإعلان
}`,
            },
          ],
        },
      ],
    });
    const block = message.content[0];
    const text = block?.type === "text" ? block.text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await db
        .update(adLibraryItemsTable)
        .set({ status: "failed", error: "no_json_in_response" })
        .where(eq(adLibraryItemsTable.id, itemId));
      return;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    await db
      .update(adLibraryItemsTable)
      .set({ status: "analyzed", aiAnalysis: parsed })
      .where(eq(adLibraryItemsTable.id, itemId));
  } catch (err) {
    await db
      .update(adLibraryItemsTable)
      .set({ status: "failed", error: (err as Error).message })
      .where(eq(adLibraryItemsTable.id, itemId));
  }
}

export default router;
