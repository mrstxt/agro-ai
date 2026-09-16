# AI integratsiyasi — AgroVet AI

Ilova rasmiy [`openai`](https://www.npmjs.com/package/openai) SDK'si orqali ishlaydi (`npm install openai`). Kalit bo'lmasa app offline demo tashxis bazasiga tushadi (`src/lib/ai.ts` ichidagi 10 ta kasallik holati).

## Env o'zgaruvchilari

| O'zgaruvchi | Majburiy | Izoh |
|---|---|---|
| `OPENAI_API_KEY` | ✅ (AI uchun) | Tashxis (chat/vision) kaliti. Bo'sh bo'lsa offline rejim. |
| `OPENAI_BASE_URL` | ❌ | Tashxis provayder endpointi (OpenAI uchun bo'sh). |
| `AI_MODEL` | ❌ | Tashxis modeli. Standart: `gpt-4o`. |
| `STT_API_KEY` | ❌ | Ovoz → matn uchun alohida kalit. Bo'lmasa `OPENAI_API_KEY` ishlatiladi. |
| `STT_BASE_URL` | ❌ | STT endpointi (masalan Groq). Bo'lmasa `OPENAI_BASE_URL`. |
| `STT_MODEL` | ❌ | STT modeli. Standart: `whisper-1`. |
| `TELEGRAM_BOT_TOKEN` | Bot uchun | BotFather beradi. |
| `TELEGRAM_WEBHOOK_SECRET` | ❌ | Webhook himoyasi (ixtiyoriy, tavsiya etiladi). |
| `NEXT_PUBLIC_APP_URL` | Bot uchun | Webhook manzili uchun domeningiz. |
| `DATABASE_URL` | ✅ | PostgreSQL (Neon). |

> Kalitlarni Freebuff'da **Settings → Environment** (yoki Keys) bo'limiga qo'ying. Vercel'da Project → Settings → Environment Variables.

## 🆓 Bepul combo (pul kerak emas)

Tashxis uchun **Google Gemini**, ovoz uchun **Groq Whisper** — ikkalasi bepul kvota bilan:

```
# Tashxis: Gemini vision (bepul, rasm + matn)
OPENAI_API_KEY=AIza...        # aistudio.google.com dan oling
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.0-flash

# Ovoz: Groq Whisper (bepul, juda tez)
STT_API_KEY=gsk_...           # console.groq.com dan oling
STT_BASE_URL=https://api.groq.com/openai/v1
STT_MODEL=whisper-large-v3
```

**Nega bu combo yaxshi:**
- Gemini API **bepul** darajada kuniga 1500 so'rov beradi (vision sifati yuqori)
- Groq `whisper-large-v3` **bepul** va OpenAI Whisper'dan 10x tezroq
- Ikkalasi ham OpenAI-compatible — kodda hech nima o'zgartirish shart emas

## Boshqa provayder variantlari

### OpenAI (pullik, sifat eng yuqori)

```
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4o        # arzonroq: gpt-4o-mini
STT_API_KEY=sk-...     # xuddi shu kalit
STT_MODEL=whisper-1
```

### OpenRouter (bitta kalit, 100+ model, ba'zilari bepul)

```
OPENAI_API_KEY=sk-or-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=qwen/qwen2.5-vl-72b-instruct
```

### Self-host vLLM

```
OPENAI_API_KEY=dummy
OPENAI_BASE_URL=https://your-vllm-server.example.com/v1
AI_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
```

> Diqqat: vLLM odatda `/audio/transcriptions` bermaydi — STT uchun Groq envlarni qo'ying.

## Qanday ishlaydi

- **Tashxis** (`POST /api/diagnose`): `aiDiagnose()` modeldan qat'iy JSON formatida javob so'raydi. Server `json_object` rejimini qo'llamasligi mumkin bo'lsa (vLLM va h.k.), avtomatik oddiy rejimda qayta urinadi. Javob markdown kod blokiga o'ralgan bo'lsa ham JSON ajratib olinadi. Xatolik bo'lsa offline rejimga tushadi.
- **Ovoz** (`POST /api/transcribe`): `transcribeAudio()` STT provayderga `language: "uz"` bilan yuboradi.
- **Telegram bot** (`POST /api/telegram/webhook`): rasm/ovozni Telegram'dan yuklab, shu funksiyalarga uzatadi.

## Tekshirish

1. `GET /api/telegram/health` — qaysi xizmatlar sozlangani ko'rsatadi.
2. Tashxis sahifasida muammoni yozing — natija `source: "ai"` bo'lsa AI ishlayapti.
3. Telegram'da botga rasm yuboring — tashxis qaytarishi kerak.
