import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; first: number }>();

const SQLI_PATTERNS: RegExp[] = [
  /(\bunion\b\s+\bselect\b)/i,
  /(\bselect\b.+\bfrom\b\s+\binformation_schema\b)/i,
  /(\bdrop\b\s+\btable\b)/i,
  /(\bor\b\s+1\s*=\s*1)/i,
  /(--\s*$)|(\/\*[\s\S]*?\*\/)/,
  /;\s*(drop|delete|update|insert)\s+/i,
  /\bxp_cmdshell\b/i,
];

const XSS_PATTERNS: RegExp[] = [
  /<\s*script[\s>]/i,
  /<\s*iframe[\s>]/i,
  /\bjavascript:/i,
  /on(error|load|click|mouseover|focus)\s*=/i,
  /<\s*img[^>]+\bonerror\s*=/i,
];

export function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0]!.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export async function sendTelegramAlert(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    logger.warn({ err }, "telegram alert failed");
  }
}

export function recordFailedLogin(ip: string, identifier?: string): void {
  const now = Date.now();
  const entry = failedLogins.get(ip);
  if (!entry || now - entry.first > FAILED_LOGIN_WINDOW_MS) {
    failedLogins.set(ip, { count: 1, first: now });
    logger.warn({ ip, identifier }, "failed_login");
    return;
  }
  entry.count += 1;
  logger.warn({ ip, identifier, count: entry.count }, "failed_login");
  if (entry.count === FAILED_LOGIN_THRESHOLD) {
    void sendTelegramAlert(
      `🚨 <b>Brute-force suspected</b>\nIP: <code>${ip}</code>\nFailed logins: ${entry.count} in 15m`,
    );
  }
}

export function recordCrossMerchantAccess(opts: {
  ip: string;
  merchantId: string;
  attemptedResource: string;
}): void {
  logger.warn(opts, "cross_merchant_access_attempt");
  void sendTelegramAlert(
    `🚨 <b>Cross-merchant access attempt</b>\nMerchant: <code>${opts.merchantId}</code>\nResource: <code>${opts.attemptedResource}</code>\nIP: <code>${opts.ip}</code>`,
  );
}

function scanValue(value: unknown): "sqli" | "xss" | null {
  if (typeof value === "string") {
    for (const p of SQLI_PATTERNS) if (p.test(value)) return "sqli";
    for (const p of XSS_PATTERNS) if (p.test(value)) return "xss";
    return null;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const r = scanValue(v);
      if (r) return r;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const r = scanValue(v);
      if (r) return r;
    }
  }
  return null;
}

export function suspiciousPatternMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Skip webhooks (signed payloads handled separately) and the OAuth popup HTML route.
  if (req.path.startsWith("/webhooks/")) return next();
  const sources: unknown[] = [req.query, req.body];
  let hit: "sqli" | "xss" | null = null;
  for (const s of sources) {
    hit = scanValue(s);
    if (hit) break;
  }
  if (hit) {
    const ip = clientIp(req);
    logger.warn(
      { ip, path: req.path, kind: hit },
      "suspicious_request_blocked",
    );
    void sendTelegramAlert(
      `🚨 <b>${hit === "sqli" ? "SQL injection" : "XSS"} attempt blocked</b>\nIP: <code>${ip}</code>\nPath: <code>${req.method} ${req.path}</code>`,
    );
    res.status(400).json({ error: "Bad request" });
    return;
  }
  next();
}

export function validate<T>(schema: {
  parse: (input: unknown) => T;
}): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      logger.info({ err, path: req.path }, "validation_failed");
      res.status(400).json({ error: "Invalid request body" });
    }
  };
}

export function validateQuery<T>(schema: {
  parse: (input: unknown) => T;
}): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.query);
      Object.defineProperty(req, "validatedQuery", {
        value: parsed,
        configurable: true,
      });
      next();
    } catch (err) {
      logger.info({ err, path: req.path }, "validation_failed");
      res.status(400).json({ error: "Invalid query parameters" });
    }
  };
}

export function buildCorsOriginCheck(): (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => void {
  const explicit = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const replitDomains = (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((d) => `https://${d}`);
  const replitDev = process.env.REPLIT_DEV_DOMAIN
    ? [`https://${process.env.REPLIT_DEV_DOMAIN}`]
    : [];
  const allowed = new Set([...explicit, ...replitDomains, ...replitDev]);
  return (origin, cb) => {
    // Same-origin and server-to-server requests omit Origin — allow them.
    if (!origin) return cb(null, true);
    if (allowed.has(origin)) return cb(null, true);
    logger.warn({ origin }, "cors_blocked");
    cb(new Error("Origin not allowed"));
  };
}
