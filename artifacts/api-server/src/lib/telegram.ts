import pino from "pino";

const log = pino({ name: "telegram" });

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

export function isTelegramConfigured(): boolean {
  return Boolean(botToken && chatId);
}

export async function sendTelegramAlert(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!isTelegramConfigured()) {
    log.debug({ text: text.slice(0, 80) }, "telegram skipped: not configured");
    return { ok: false, error: "not_configured" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      log.warn({ status: res.status, body: body.slice(0, 200) }, "telegram non-2xx");
      return { ok: false, error: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    log.error({ err }, "telegram send failed");
    return { ok: false, error: (err as Error).message };
  }
}
