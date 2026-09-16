#!/bin/sh
# Telegram webhook sozlash (yuritish: sh ./scripts/setup-telegram-webhook.sh)
# .env.local yoki .env ichida quyidagilar bo'lishi kerak:
#   TELEGRAM_BOT_TOKEN=123456:ABC...
#   NEXT_PUBLIC_APP_URL=https://sizning-domen.uz
#   TELEGRAM_WEBHOOK_SECRET=uzun-tasodifiy-satr (ixtiyoriy, xavfsizlik uchun)

set -e

# .env.local va .env dan o'qish (KEY=VALUE formatida, izohlar tashlab yuboriladi)
ENV_FILE="${ENV_FILE:-}"
if [ -z "$ENV_FILE" ]; then
  if [ -f .env.local ]; then ENV_FILE=.env.local; elif [ -f .env ]; then ENV_FILE=.env; fi
fi
if [ -n "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      ''|\#*) continue ;;
    esac
    key=$(printf '%s' "$key" | tr -d ' \r')
    value=$(printf '%s' "$value" | tr -d ' \r')
    if [ -n "$key" ] && [ -n "$value" ]; then
      eval "export $key='$value'" 2>/dev/null || true
    fi
  done < "$ENV_FILE"
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "XATO: TELEGRAM_BOT_TOKEN o'rnatilmagan." >&2
  exit 1
fi
if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
  echo "XATO: NEXT_PUBLIC_APP_URL o'rnatilmagan (masalan: https://agrovet.uz)." >&2
  exit 1
fi

WEBHOOK_URL="${NEXT_PUBLIC_APP_URL%/}/api/telegram/webhook"

echo "Webhook o'rnatilmoqda: $WEBHOOK_URL"
ARGS="-d url=$WEBHOOK_URL"
if [ -n "$TELEGRAM_WEBHOOK_SECRET" ]; then
  ARGS="$ARGS -d secret_token=$TELEGRAM_WEBHOOK_SECRET"
fi
ARGS="$ARGS -d drop_pending_updates=true"

RESULT=$(curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" $ARGS)
echo "Natija: $RESULT"

echo ""
echo "Joriy holat:"
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | head -c 1000
echo ""
