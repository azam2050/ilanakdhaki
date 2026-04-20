import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { runOptimizationCycle } from "../lib/optimizer";
import { runDailyCopyCycle } from "../lib/dailyCopy";
import { runAlertsCycle } from "../lib/alertsCron";
import { sendTelegramAlert, isTelegramConfigured } from "../lib/telegram";
import { sendEmail, renderArabicAlertEmail, isEmailConfigured } from "../lib/email";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const enabled = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEBUG_TRIGGERS === "true";

function gate(req: Request, res: Response, next: NextFunction): void {
  if (!enabled) { res.status(404).json({ error: "not_found" }); return; }
  requireAdmin(req, res, next);
}

router.post("/debug/run-optimizer", gate, async (_req, res) => {
  try {
    const result = await runOptimizationCycle();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/debug/run-daily-copy", gate, async (_req, res) => {
  try {
    const result = await runDailyCopyCycle();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/debug/run-alerts", gate, async (_req, res) => {
  try {
    const r = await runAlertsCycle();
    res.json({ ok: true, ...r });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/debug/test-telegram", gate, async (_req, res) => {
  if (!isTelegramConfigured()) {
    res.json({ ok: false, configured: false, error: "TELEGRAM_BOT_TOKEN/CHAT_ID not set" });
    return;
  }
  const r = await sendTelegramAlert("<b>اختبار اتصال</b>\nرسالة تجريبية من نظام الإعلانات الذكية.");
  res.json({ configured: true, ...r });
});

router.post("/debug/test-email", gate, async (_req, res) => {
  if (!isEmailConfigured()) {
    res.json({ ok: false, configured: false, error: "RESEND_API_KEY not set" });
    return;
  }
  const to = process.env.TEST_EMAIL_TO;
  if (!to) {
    res.status(400).json({ ok: false, error: "TEST_EMAIL_TO env not set (whitelisted recipient required)" });
    return;
  }
  const html = renderArabicAlertEmail({
    storeName: "متجر تجريبي",
    alertNameArabic: "اختبار الإيميل",
    daysUntil: 7,
    recommendation: "هذه رسالة تجريبية للتأكد من إعدادات Resend.",
  });
  const r = await sendEmail({ to, subject: "اختبار اتصال — الإعلانات الذكية", html });
  res.json({ configured: true, ...r });
});

export default router;
