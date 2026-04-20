import { Resend } from "resend";
import pino from "pino";

const log = pino({ name: "email" });

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM ?? "noreply@example.com";

let _client: Resend | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(apiKey);
}

function client(): Resend {
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  if (!_client) _client = new Resend(apiKey);
  return _client;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isEmailConfigured()) {
    log.warn({ to: opts.to, subject: opts.subject }, "email skipped: RESEND_API_KEY not set");
    return { ok: false, error: "not_configured" };
  }
  try {
    const result = await client().emails.send({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (result.error) {
      log.error({ err: result.error }, "resend error");
      return { ok: false, error: String(result.error.message ?? result.error) };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    log.error({ err }, "email send failed");
    return { ok: false, error: (err as Error).message };
  }
}

export function renderArabicAlertEmail(opts: {
  storeName: string;
  alertNameArabic: string;
  daysUntil: number;
  recommendation: string;
}): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>${opts.alertNameArabic}</title></head>
<body style="font-family:-apple-system,Segoe UI,Tahoma,sans-serif;background:#f8fafc;margin:0;padding:24px;direction:rtl;text-align:right;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
    <div style="color:#0ea5e9;font-size:14px;font-weight:600;margin-bottom:8px;">تنبيه موسمي</div>
    <h1 style="font-size:22px;color:#0f172a;margin:0 0 16px;">${opts.alertNameArabic} — بعد ${opts.daysUntil} يوم</h1>
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 20px;">
      مرحباً ${opts.storeName}،<br>
      اقتربنا من موسم ${opts.alertNameArabic}. بدأنا في تجهيز حملاتك تلقائياً لتلتقط الفرصة قبل المنافسين.
    </p>
    <div style="background:#f0f9ff;border-right:4px solid #0ea5e9;padding:16px;border-radius:8px;color:#0c4a6e;font-size:14px;line-height:1.6;">
      ${opts.recommendation}
    </div>
    <p style="color:#64748b;font-size:13px;margin-top:24px;">— فريق الإعلانات الذكية</p>
  </div>
</body></html>`;
}
