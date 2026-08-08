#!/usr/bin/env bash
# OTP SMS ni yangilab ishga tushirish (local yoki VPS)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1) GitHub dan yangi kod ==="
git fetch origin main || true
git pull origin main || true

echo ""
echo "=== 2) Kod tekshiruvi ==="
if ! grep -q 'OTP_ENGINE=UNIVERSAL_OTP_V3' api/src/auth/devsms.service.ts \
  && ! grep -q "UNIVERSAL_OTP_V3" api/src/auth/devsms.service.ts; then
  echo "XATO: yangi DevSMS kodi topilmadi."
  exit 1
fi
echo "OK: UNIVERSAL_OTP_V3 kodi bor."

echo ""
echo "=== 3) api/.env ==="
ENV_FILE="api/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp api/.env.example api/.env
  echo "api/.env .env.example dan yaratildi — DEVSMS_TOKEN ni to'ldiring"
fi

# Eski / noto'g'ri kalitlarni tozalash
sed -i '/^DEVSMS_OTP_MODE=/d' "$ENV_FILE" || true
sed -i '/^DEVSMS_OTP_TEMPLATE=/d' "$ENV_FILE" || true

if ! grep -q '^DEVSMS_BASE_URL=' "$ENV_FILE"; then
  echo 'DEVSMS_BASE_URL=https://devsms.uz/api' >> "$ENV_FILE"
fi

# service_name — apostrofsiz
if grep -q '^DEVSMS_SERVICE_NAME=' "$ENV_FILE"; then
  sed -i 's/^DEVSMS_SERVICE_NAME=.*/DEVSMS_SERVICE_NAME=Mexrli Qollar/' "$ENV_FILE"
else
  echo 'DEVSMS_SERVICE_NAME=Mexrli Qollar' >> "$ENV_FILE"
fi

if ! grep -qE '^DEVSMS_TOKEN=.+' "$ENV_FILE"; then
  echo "XATO: api/.env da DEVSMS_TOKEN bo'sh."
  echo "  Tokenni yozing yoki: DEVSMS_TOKEN=... ./scripts/write-local-envs.sh"
  exit 1
fi

echo "OK:"
grep -E '^DEVSMS_' "$ENV_FILE" | sed 's/\(DEVSMS_TOKEN=\).\{8\}.*/\1********/'

echo ""
echo "=== 4) Build ==="
rm -rf api/dist
(cd api && npx prisma generate >/dev/null && npm run build)

echo ""
echo "=== 5) Restart ==="
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart qulay-ish-api 2>/dev/null || pm2 restart api 2>/dev/null || pm2 restart all || true
else
  echo "pm2 yo'q — API ni qo'lda restart qiling: cd api && npm run start:prod"
fi

echo ""
echo "Tekshiruv:"
echo "  curl -s https://ishliayol.uz/api/auth/sms-status"
echo "  ./scripts/check-otp.sh"
