import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function flag(v: string | undefined) {
  return Boolean(v && v.trim());
}

export async function GET() {
  const chatModel = flag(process.env.OPENAI_API_KEY);
  const sttDedicated = flag(process.env.STT_API_KEY);
  return NextResponse.json({
    ok: true,
    bot: {
      token: flag(process.env.TELEGRAM_BOT_TOKEN),
      webhookSecret: flag(process.env.TELEGRAM_WEBHOOK_SECRET),
      appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
    },
    ai: {
      diagnosis: chatModel ? "configured" : "offline-mode",
      stt: sttDedicated ? "dedicated (STT_* env)" : chatModel ? "shared OPENAI_* env" : "disabled",
      model: process.env.AI_MODEL || "gpt-4o",
      sttModel: process.env.STT_MODEL || process.env.ASR_MODEL || "whisper-1",
    },
  });
}
