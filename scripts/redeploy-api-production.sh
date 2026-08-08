#!/usr/bin/env bash
# Production serverda (ishliayol.uz) Nest API ni yangilash.
# APK "Failed to fetch" / CORS va SMS OTP uchun kerak.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull origin main

echo "==> api npm install + build"
cd "$ROOT/api"
npm install --no-fund --no-audit
npx prisma generate
npx prisma migrate deploy
npm run build

ENV_FILE="$ROOT/api/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE yo'q. Production api/.env yarating."
  exit 1
fi

# Ensure Capacitor / website origins are listed (main.ts also merges these,
# but keep .env explicit for ops clarity).
if ! grep -q 'CORS_ORIGIN=' "$ENV_FILE"; then
  echo "CORS_ORIGIN=https://ishliayol.uz,https://www.ishliayol.uz,https://localhost,capacitor://localhost,http://localhost:3000" >> "$ENV_FILE"
  echo "==> CORS_ORIGIN qo'shildi"
else
  echo "==> CORS_ORIGIN mavjud (Nest endi Capacitor originlarni har doim qo'shadi)"
fi

if ! grep -qE '^DEVSMS_TOKEN=.+' "$ENV_FILE"; then
  echo "WARNING: DEVSMS_TOKEN bo'sh — OTP SMS ishlamaydi. DevSMS token qo'ying va qayta restart qiling."
fi

# Prefer pm2 if present
if command -v pm2 >/dev/null 2>&1; then
  echo "==> pm2 restart"
  # Common process names — adjust if your process is named differently
  pm2 restart qulay-ish-api 2>/dev/null \
    || pm2 restart api 2>/dev/null \
    || pm2 restart all \
    || true
  pm2 save || true
else
  echo "pm2 topilmadi — API ni o'zingiz restart qiling (systemd/docker)."
fi

echo "==> CORS smoke (https://localhost origin)"
sleep 2
HDR="$(curl -sI -X OPTIONS 'https://ishliayol.uz/api/auth/send-otp' \
  -H 'Origin: https://localhost' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' || true)"
echo "$HDR" | head -20
if echo "$HDR" | grep -qi 'Access-Control-Allow-Origin: https://localhost'; then
  echo "OK: Capacitor Origin ruxsat etilgan"
else
  echo "WARN: Allow-Origin hali yo'q — API restart / nginx cache tekshiring"
fi

echo "Done."
