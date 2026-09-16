import { NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/bot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Telegram webhook.
 * Sozlash:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *     -d "url=https://sizning-domen.uz/api/telegram/webhook" \
 *     -d "secret_token=$(cat .env | grep TELEGRAM_WEBHOOK_SECRET | cut -d= -f2)"
 * Yoki: npm run bot:setup
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  try {
    await handleTelegramUpdate(update as Parameters<typeof handleTelegramUpdate>[0]);
  } catch (err) {
    console.error("telegram webhook error", err);
  }
  // Telegram 200 kutadi, aks holda qayta yuboraveradi.
  return NextResponse.json({ ok: true });
}
