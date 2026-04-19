import { Router, type IRouter, raw } from "express";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  merchantsTable,
  networkEventsTable,
  processedWebhooksTable,
  auditLogTable,
} from "@workspace/db";
import { hashCustomer, verifyHmacSha256 } from "../../lib/crypto";
import { requireSallaConfig } from "../../lib/salla";

const router: IRouter = Router();

interface SallaCustomer {
  email?: string;
  mobile?: string;
  city?: string;
  district?: string;
}

interface SallaWebhookPayload {
  event?: string;
  merchant?: number | string;
  data?: {
    id?: number | string;
    customer?: SallaCustomer;
    shipping?: { city?: string; district?: string };
    total?: { amount?: number } | number;
    amounts?: { total?: { amount?: number } };
    items?: Array<{
      product?: {
        categories?: Array<{ name?: string }>;
        type?: string;
      };
    }>;
    email?: string;
    mobile?: string;
    city?: string;
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

function pickSubCategory(p: SallaWebhookPayload): string | null {
  const cats = p.data?.items?.[0]?.product?.categories;
  return cats?.[1]?.name ?? null;
}

const SUPPORTED_EVENTS: Record<string, string> = {
  "order.created": "purchase",
  "cart.abandoned": "abandoned_cart",
  "abandoned.cart": "abandoned_cart",
  "customer.created": "customer_signup",
};

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
    const headerEventId =
      (req.headers["x-salla-event-id"] as string | undefined) ??
      (req.headers["x-event-id"] as string | undefined) ??
      null;
    const bodyHash = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("hex");
    const dedupeKey = headerEventId
      ? `salla:evt:${headerEventId}`
      : externalId
        ? `salla:${eventName}:${sallaMerchantId ?? "_"}:${externalId}`
        : `salla:hash:${bodyHash}`;

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

    const eventType = SUPPORTED_EVENTS[eventName];
    if (!eventType) {
      // Acknowledge unsupported events so Salla does not retry, but do not store them.
      await db.insert(auditLogTable).values({
        merchantId: merchant.id,
        action: `webhook.salla.${eventName}.ignored`,
        details: { externalId },
        ipAddress: req.ip ?? null,
      });
      res.status(200).json({ ok: true, ignored: "unsupported_event" });
      return;
    }

    const customer: SallaCustomer | undefined =
      payload.data?.customer ??
      (eventName === "customer.created"
        ? {
            email: payload.data?.email,
            mobile: payload.data?.mobile,
            city: payload.data?.city,
          }
        : undefined);
    const city =
      customer?.city ?? payload.data?.shipping?.city ?? null;
    const district =
      customer?.district ?? payload.data?.shipping?.district ?? null;

    await db.insert(networkEventsTable).values({
      merchantId: merchant.id,
      eventType,
      customerEmailHash: hashCustomer(customer?.email),
      customerPhoneHash: hashCustomer(customer?.mobile),
      city,
      district,
      orderValue: eventType === "purchase" ? pickOrderValue(payload) : null,
      productCategory: pickCategory(payload),
      subCategory: pickSubCategory(payload),
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
