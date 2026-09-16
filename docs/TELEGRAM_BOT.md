# Telegram Bot — AgroVet AI

Bot web ilovaning barcha xizmatlarini to'g'ridan-to'g'ri Telegram ichida beradi. Mini App bilan birga ishlaydi (Mini App havolasi `/kirish` orqali ochiladi).

## Bot funksiyalari

| Xizmat | Qanday ishlaydi |
|---|---|
| 🌿 Ekin tashxis | Rasm (+ izoh) yoki matn yuboring — AI kasallikni aniqlaydi |
| 🐄 Hayvon tashxis | Rasm, ovoz (STT) yoki matn yuboring |
| 💊 Dorixona | Joylashuv yuboring — eng yaqin 5 ta nuqta, telefon va ish vaqti bilan |
| 🌤 Ob-havo | Joylashuv bo'yicha harorat + purkash maslahati |
| 📰 Yangiliklar | So'nggi 5 ta agro yangilik |
| 👤 Profil | Ism, tuman, tashxislar tarixi |

Buyruqlar: `/start`, `/help`.

**Smart xususiyatlar:**
- Matndan mavzuni taniydi: «kartoshka bargi qarayapti» yozsa avtomatik ekin rejimiga o'tadi
- Ovoz xabarlarini Whisper (o'zbek tili) orqali matnga aylantiradi
- Dorixonalarni Telegram **venue** kartasi bilan yuboradi — bosing va yo'nalish oling
- Rasm yuklanayotganda "yuklanmoqda" holatini ko'rsatadi

## Sozlash (5 qadam)

1. **@BotFather** da bot yarating: `/newbot` → nom va username bering.
2. BotFather bergan tokenni envga qo'ying:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC...
   ```
3. Sayt HTTPS domenida ishlab turganini tekshiring va envga qo'ying:
   ```
   NEXT_PUBLIC_APP_URL=https://sizning-domen.uz
   ```
4. Ixtiyoriy, lekin tavsiya etiladi — webhook sirini yarating:
   ```
   TELEGRAM_WEBHOOK_SECRET=uzun-tasodifiy-satr
   ```
5. Webhookni ulang (lokiha ildizida):
   ```bash
   npm run bot:setup
   ```

Tayyor! Telegram'da botni oching va `/start` yuboring.

## Mini App (menyu tugmasi)

BotFather → `/newapp` → botni tanlang → Upload web app URL sifatida `NEXT_PUBLIC_APP_URL` ni bering. Bu botni "Launch App" tugmasi bilan Mini Appga aylantiradi.

## Konfiguratsiya holatini tekshirish

```
GET /api/telegram/health
```

Javob: bot token, webhook sir, AI rejimi (ai/offline) va STT holati. Xavfsizlik uchun faqat sozlangan/yuq emas ma'lumot qaytaradi.

## Arxitektura

- `src/lib/bot.ts` — barcha bot logikasi (xabarlar, callback tugmalar, xizmatlar)
- `src/app/api/telegram/webhook/route.ts` — webhook (Telegramdan kelgan update'larni qabul qiladi, `TELEGRAM_WEBHOOK_SECRET` bilan tekshiradi)
- `src/app/api/telegram/health/route.ts` — konfiguratsiya tekshiruvi
- `scripts/setup-telegram-webhook.sh` — webhookni Telegram API'ga ro'yxatdan o'tkazadi
- `src/lib/geo.ts` — joylashuv → tuman nomi (BigDataCloud, bepul) + ob-havo maslahati (Open-Meteo, bepul)
