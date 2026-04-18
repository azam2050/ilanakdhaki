import { Router, type IRouter, raw } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  merchantsTable,
  eventsTable,
  processedWebhooksTable,
  auditLogTable,
} from "@workspace/db";
import { hashCustomer, verifyHmacSha256 } from "../../lib/crypto";
import { requireSallaConfig } from "../../lib/salla";

const router: IRouter = Router();

interface SallaWebhookPayload {
  event?: string;
  merchant?: number | string;
  data?: {
    id?: number | string;
    customer?: {
      email?: string;
      mobile?: string;
      city?: string;
    };
    shipping?: { city?: string };
    total?: { amount?: number } | number;
    amounts?: { total?: { amount?: number } };
    items?: Array<{
      product?: { categories?: Array<{ name?: string }> };
    }>;
  };
}

function pickOrderValue(p: SallaWebhookPayload): string | null {
  const t = p.data?.total;
  if (typeof t === "number") return t.toFixed(2);
  if (t && typeof t === "object" && typeof t.amount === "number") {
    return t.amount.toFixed(2);
  }
  const at = p.data?.amounts?.total?.amount;
  if (typeof at === "number") return at.toFixed(2);
  return null;
}

function pickCategory(p: SallaWebhookPayload): string | null {
  const cats = p.data?.items?.[0]?.product?.categories;
  return cats?.[0]?.name ?? null;
}

function eventTypeFromSallaEvent(event: string): string {
  if (event.startsWith("order.")) return "purchase";
  if (event.startsWith("abandoned")) return "abandoned_cart";
  if (event.startsWith("cart.")) return "add_to_cart";
  if (event.startsWith("product.viewed")) return "view";
  return event;
}

router.post(
  "/webhooks/salla",
  raw({ type: "*/*", limit: "1mb" }),
  async (req, res): Promise<void> => {
    let cfg;
    try {
      cfg = requireSallaConfig();
    } catch (err) {
      req.log.error({ err }, "Salla webhook called but not configured");
      res.status(503).json({ error: "Salla not configured" });
      return;
    }

    const signature =
      (req.headers["x-salla-signature"] as string | undefined) ??
      (req.headers["x-salla-security-strategy"] as string | undefined) ??
      "";
    const rawBody: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from("");

    if (!signature || !verifyHmacSha256(rawBody, signature, cfg.webhookSecret)) {
      req.log.warn("Salla webhook signature mismatch");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    let payload: SallaWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as SallaWebhookPayload;
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    const eventName = payload.event ?? "unknown";
    const sallaMerchantId = payload.merchant
      ? String(payload.merchant)
      : null;
    const externalId = payload.data?.id ? String(payload.data.id) : null;
    const dedupeKey = `salla:${eventName}:${sallaMerchantId ?? "_"}:${externalId ?? rawBody.length}`;

    try {
      await db.insert(processedWebhooksTable).values({
        id: dedupeKey,
        provider: "salla",
      });
    } catch {
      req.log.info({ dedupeKey }, "Duplicate webhook ignored");
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    if (!sallaMerchantId) {
      res.status(200).json({ ok: true, ignored: "no_merchant" });
      return;
    }

    const [merchant] = await db
      .select()
      .from(merchantsTable)
      .where(eq(merchantsTable.sallaMerchantId, sallaMerchantId))
      .limit(1);

    if (!merchant) {
      req.log.warn({ sallaMerchantId, eventName }, "Webhook for unknown merchant");
      res.status(200).json({ ok: true, ignored: "unknown_merchant" });
      return;
    }

    const eventType = eventTypeFromSallaEvent(eventName);
    const customer = payload.data?.customer;
    const city = customer?.city ?? payload.data?.shipping?.city ?? null;

    await db.insert(eventsTable).values({
      merchantId: merchant.id,
      eventType,
      customerEmailHash: hashCustomer(customer?.email),
      customerPhoneHash: hashCustomer(customer?.mobile),
      city,
      orderValue: pickOrderValue(payload),
      productCategory: pickCategory(payload),
    });

    await db.insert(auditLogTable).values({
      merchantId: merchant.id,
      action: `webhook.salla.${eventName}`,
      details: { externalId },
      ipAddress: req.ip ?? null,
    });

    res.status(200).json({ ok: true });
  },
);

export default router;
