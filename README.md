# AgroVet AI

Telegram Mini App va web sayt sifatida ishlaydigan agro/chorva yordamchi.

## Imkoniyatlar

- Telegram Mini App: Telegram SDK, WebApp initData login, mobil ilova uslubidagi UI.
- Web sayt: desktop browserda keng web layout va top navigation.
- AI tashxis: rasm, matn yoki ovoz asosida ekin/chorva muammosini tahlil qiladi.
- Open-source AI tayyor: OpenAI-compatible endpoint orqali Qwen, InternVL, Llama, Gemma yoki vLLM serverga ulanish mumkin.
- Real maslahatlar: Open-Meteo ob-havo API asosida purkash/chorva parvarishi bo'yicha tavsiya.
- Xarita: Leaflet + OpenStreetMap, yaqin agro/vet dorixonalar va dori mavjudligi.
- Database: PostgreSQL/Neon + Drizzle ORM.

## Local Ishga Tushirish

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

`.env` ichida `DATABASE_URL` Neon yoki local Postgres URL bo'lishi kerak.

## Neon Database

1. Neon project yarating.
2. Connection stringni oling. U odatda shunday ko'rinadi:

```bash
postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require
```

3. Shu qiymatni Vercel va local `.env` ichidagi `DATABASE_URL`ga qo'ying.
4. Jadval yaratish:

```bash
npm run db:migrate
```

Vercelda `vercel-build` script migrationni builddan oldin avtomatik yuritadi.

## Vercel Deploy

Vercel env variables:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require
TELEGRAM_BOT_TOKEN=123456:ABC...
OPENAI_API_KEY=...
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

Open-source model ishlatish uchun:

```bash
OPENAI_BASE_URL=https://your-vllm-server.example.com/v1
AI_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
```

OpenAI ishlatilsa `OPENAI_BASE_URL` bo'sh qoladi va `AI_MODEL=gpt-4o` bo'lishi mumkin.

## Telegram Mini App

BotFather:

1. `@BotFather` oching.
2. Bot yarating yoki mavjud botni tanlang.
3. Mini App uchun:

```text
/newapp
```

yoki bot menu tugmasi uchun:

```text
/setmenubutton
```

4. URL sifatida Vercel HTTPS domenini kiriting.
5. `TELEGRAM_BOT_TOKEN` envga aynan shu bot tokenini qo'ying.

Telegram ichida ochilganda app mobil Mini App ko'rinishida ishlaydi. Oddiy browserda ochilganda web sayt layout chiqadi.

## Tavsiya Qilingan Open-Source AI

> AI rasmiy `openai` SDK'si orqali ulanadi (`npm install openai`). Sozlash va provayder variantlari (OpenAI, Gemini, OpenRouter, vLLM) uchun `docs/AI_SETUP.md` faylini ko'ring.

MVP uchun:

- `Qwen/Qwen2.5-VL-7B-Instruct` - rasm + matn tashxis uchun eng yaxshi balans.
- `Qwen3-Embedding-0.6B` yoki `Qwen3-Embedding-4B` - real hujjatlardan RAG qidiruv uchun.
- `Qwen3-Reranker-0.6B` - topilgan maslahatlarni saralash uchun.

Kuchliroq production uchun:

- `Qwen/Qwen2.5-VL-32B-Instruct`
- `InternVL3-8B` yoki `InternVL3-78B`
- `Llama-4-Scout` agar Llama litsenziyasi mos bo'lsa.

## Tekshiruv

```bash
npm run lint
npm run typecheck
npm run build
```

`npm run build` uchun `DATABASE_URL` kerak.
