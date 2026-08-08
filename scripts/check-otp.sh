#!/usr/bin/env bash
# OTP / env / production SMS diagnostikasi
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; }

echo "=== 1) Lokal env fayllar ==="
[[ -f .env.capacitor ]] && grep -q 'VITE_API_URL=https://ishliayol.uz/api' .env.capacitor && ok ".env.capacitor → ishliayol.uz/api" || bad ".env.capacitor API URL"
[[ -f api/.env ]] || { bad "api/.env yo'q — ./scripts/write-local-envs.sh"; exit 1; }
if grep -qE '^DEVSMS_TOKEN=.+' api/.env; then ok "api/.env DEVSMS_TOKEN bor"; else bad "api/.env DEVSMS_TOKEN bo'sh"; fi
if grep -qE '^DEVSMS_SERVICE_NAME=' api/.env; then ok "DEVSMS_SERVICE_NAME=$(grep '^DEVSMS_SERVICE_NAME=' api/.env | cut -d= -f2-)"; fi

echo ""
echo "=== 2) DevSMS to'g'ridan-to'g'ri ==="
TOKEN=$(grep '^DEVSMS_TOKEN=' api/.env | cut -d= -f2-)
BASE=$(grep '^DEVSMS_BASE_URL=' api/.env | cut -d= -f2-)
BASE=${BASE:-https://devsms.uz/api}
SVC=$(grep '^DEVSMS_SERVICE_NAME=' api/.env | cut -d= -f2-)
SVC=${SVC:-Mexrli Qollar}
RESP=$(curl -sS -X POST "$BASE/send_sms.php" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"phone\":\"998900000001\",\"type\":\"universal_otp\",\"template_type\":3,\"service_name\":\"$SVC\",\"otp_code\":\"000000\"}" || true)
echo "$RESP" | head -c 300; echo
echo "$RESP" | grep -q '"success":true' && ok "DevSMS token/service ishlaydi" || bad "DevSMS javobi success emas"

echo ""
echo "=== 3) Production sms-status ==="
STATUS=$(curl -sS --connect-timeout 8 https://ishliayol.uz/api/auth/sms-status || echo '{}')
echo "$STATUS"
if echo "$STATUS" | grep -q '"configured":true'; then
  ok "Production DEVSMS_TOKEN sozlangan"
elif echo "$STATUS" | grep -q 'configured'; then
  bad "Production DEVSMS_TOKEN YO'Q — VPS api/.env ga token qo'ying va API restart"
else
  bad "sms-status endpoint yo'q (eski API) — VPS da git pull + redeploy qiling"
fi

echo ""
echo "=== 4) Production CORS (APK Origin) ==="
HDR=$(curl -sI -X OPTIONS 'https://ishliayol.uz/api/auth/send-otp' \
  -H 'Origin: https://ishliayol.uz' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' || true)
echo "$HDR" | grep -qi 'Access-Control-Allow-Origin: https://ishliayol.uz' && ok "CORS ishliayol.uz" || bad "CORS ishliayol.uz"

echo ""
echo "=== Xulosa ==="
echo "APK SMS ishlashi uchun:"
echo "  1) VPS: git pull + api/.env da DEVSMS_TOKEN + ./scripts/redeploy-api-production.sh"
echo "  2) curl https://ishliayol.uz/api/auth/sms-status  → configured:true"
echo "  3) Kali: ./scripts/build-apk.sh release  (yangi APK)"
