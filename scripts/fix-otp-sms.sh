#!/usr/bin/env bash
# OTP SMS ni yangilab ishga tushirish — bir marta ishlatiladi
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1) GitHub dan yangi kod ==="
git fetch origin main
git checkout -- api/src/auth/devsms.service.ts api/src/auth/otp.service.ts api/src/auth/otp.constants.ts 2>/dev/null || true
git pull origin main

echo ""
echo "=== 2) Yangi kod tekshiruvi ==="
if ! grep -q 'universal_otp (moderatsiyasiz)' api/src/auth/devsms.service.ts; then
  echo "XATO: yangi DevSMS kodi topilmadi. git pull ishlamadi."
  exit 1
fi
if grep -q 'DevSMS send failed' api/src/auth/devsms.service.ts; then
  echo "XATO: hali eski kod. To'xtatildi."
  exit 1
fi
echo "OK: yangi universal_otp kodi bor."

echo ""
echo "=== 3) api/.env tozalash ==="
ENV_FILE="api/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "api/.env yo'q — .env.example dan nusxa"
  cp api/.env.example api/.env
fi

# Eski OTP sozlamalarini olib tashlash / yangilash
sed -i '/^DEVSMS_OTP_MODE=/d' "$ENV_FILE"
sed -i '/^DEVSMS_OTP_TEMPLATE=/d' "$ENV_FILE"
sed -i '/^DEVSMS_FROM=/d' "$ENV_FILE"
sed -i '/^# DEVSMS_FROM=/d' "$ENV_FILE"

if ! grep -q '^DEVSMS_SERVICE_NAME=' "$ENV_FILE"; then
  echo 'DEVSMS_SERVICE_NAME=ishliayol.uz' >> "$ENV_FILE"
fi

if ! grep -q '^DEVSMS_TOKEN=.\+' "$ENV_FILE"; then
  echo "XATO: api/.env da DEVSMS_TOKEN bo'sh. Token qo'ying."
  exit 1
fi

echo "OK: .env tozalandi. Muhim qatorlar:"
grep -E '^DEVSMS_' "$ENV_FILE" | sed 's/\(DEVSMS_TOKEN=\).\{8\}.*/\1********/'

echo ""
echo "=== 4) Eski build tozalash ==="
rm -rf api/dist
cd api
npx prisma generate >/dev/null

echo ""
echo "=== 5) API ishga tushirish ==="
echo "Keyingi qadam:  npm run start:dev"
echo "Logda shu chiqishi SHART:"
echo "  DevSMS OTP: universal_otp (moderatsiyasiz)"
echo ""
echo "Agar yana 'модерацию' chiqsa — logda 'DevSMS so'\''rov:' qatorini yuboring."
