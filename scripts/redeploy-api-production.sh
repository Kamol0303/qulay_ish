#!/usr/bin/env bash
# Production serverda (mexrliqollar.uz / 185.203.237.57) Nest API ni yangilash.
# Bu skriptni Kali desktopda emas — VPS/SSH sessiyasida ishga tushiring.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROD_HOST="${PROD_HOST:-ishliayol.uz}"
PROD_IP="${PROD_IP:-185.203.237.57}"

is_production_host() {
  # 1) Explicit override
  if [[ "${FORCE_PROD_REDEPLOY:-}" == "1" ]]; then
    return 0
  fi
  # 2) Classic deploy path
  if [[ "$ROOT" == /var/www/* ]] || [[ "$ROOT" == /srv/* ]]; then
    return 0
  fi
  # 3) This machine has the public IP
  if command -v hostname >/dev/null 2>&1; then
    if hostname -I 2>/dev/null | tr ' ' '\n' | grep -qx "$PROD_IP"; then
      return 0
    fi
  fi
  # 4) Local Nest already serves /api on :4000 and nginx proxies (weak signal)
  if curl -sf "http://127.0.0.1:4000/api/stats/counts" >/dev/null 2>&1 \
    && [[ -f /etc/nginx/sites-enabled/ishliayol.uz || -f /etc/nginx/sites-available/ishliayol.uz \
      || -f /etc/nginx/sites-enabled/mexrliqollar.uz || -f /etc/nginx/sites-available/mexrliqollar.uz ]]; then
    return 0
  fi
  return 1
}

if ! is_production_host; then
  cat <<EOF
ERROR: Bu mashina production server emas.

Siz hozir lokal papkadasiz: $ROOT
Production: https://$PROD_HOST  (IP: $PROD_IP)

Kali'da faqat APK qurish kifoya (CORS ni APK tomonda aylanib o'tadi):
  cd ~/Desktop/qulay_ish
  git pull origin main
  ./scripts/build-apk.sh release

Production API (CORS + SMS OTP) ni yangilash uchun VPS ga kiring:
  ssh root@$PROD_IP
  # yoki: ssh user@$PROD_HOST

  cd /var/www/qulay-ish   # serverdagi haqiqiy papka
  # agar papka boshqa bo'lsa:
  #   find /var/www /home /opt -maxdepth 3 -type d -name 'qulay_ish' 2>/dev/null
  git pull origin main
  ./scripts/redeploy-api-production.sh

Majburiy override (faqat chindan ham shu serverda bo'lsangiz):
  FORCE_PROD_REDEPLOY=1 ./scripts/redeploy-api-production.sh
EOF
  exit 1
fi

echo "==> Production host OK ($ROOT)"
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

if ! grep -q 'CORS_ORIGIN=' "$ENV_FILE"; then
  echo "CORS_ORIGIN=https://ishliayol.uz,https://www.ishliayol.uz,https://localhost,capacitor://localhost,capacitor://ishliayol.uz,http://localhost:3000" >> "$ENV_FILE"
  echo "==> CORS_ORIGIN qo'shildi"
else
  echo "==> CORS_ORIGIN mavjud (Nest Capacitor originlarni ham merge qiladi)"
fi

# Optional: inject token from environment when redeploying
if [[ -n "${DEVSMS_TOKEN:-}" ]]; then
  if grep -q '^DEVSMS_TOKEN=' "$ENV_FILE"; then
    sed -i "s|^DEVSMS_TOKEN=.*|DEVSMS_TOKEN=${DEVSMS_TOKEN}|" "$ENV_FILE"
  else
    echo "DEVSMS_TOKEN=${DEVSMS_TOKEN}" >> "$ENV_FILE"
  fi
  echo "==> DEVSMS_TOKEN yangilandi (env dan)"
fi

if ! grep -q '^DEVSMS_BASE_URL=' "$ENV_FILE"; then
  echo 'DEVSMS_BASE_URL=https://devsms.uz/api' >> "$ENV_FILE"
fi
if grep -q '^DEVSMS_SERVICE_NAME=' "$ENV_FILE"; then
  sed -i 's/^DEVSMS_SERVICE_NAME=.*/DEVSMS_SERVICE_NAME=Mexrli Qollar/' "$ENV_FILE"
else
  echo 'DEVSMS_SERVICE_NAME=Mexrli Qollar' >> "$ENV_FILE"
fi

if ! grep -qE '^DEVSMS_TOKEN=.+' "$ENV_FILE"; then
  echo "ERROR: DEVSMS_TOKEN bo'sh — OTP SMS ishlamaydi."
  echo "  VPS da: nano api/.env  → DEVSMS_TOKEN=... qo'ying"
  echo "  yoki: DEVSMS_TOKEN=xxx FORCE_PROD_REDEPLOY=1 ./scripts/redeploy-api-production.sh"
  exit 1
fi
echo "==> DevSMS OK (service=Mexrli Qollar)"

restart_api() {
  if command -v pm2 >/dev/null 2>&1; then
    echo "==> pm2 restart"
    pm2 restart qulay-ish-api 2>/dev/null \
      || pm2 restart qulay_ish_api 2>/dev/null \
      || pm2 restart api 2>/dev/null \
      || pm2 restart all
    pm2 save || true
    return 0
  fi
  if systemctl list-unit-files 2>/dev/null | grep -qE 'qulay|ishliayol|mexrliqollar'; then
    echo "==> systemctl restart"
    sudo systemctl restart qulay-ish-api 2>/dev/null \
      || sudo systemctl restart ishliayol-api 2>/dev/null \
      || sudo systemctl restart mexrliqollar-api 2>/dev/null \
      || true
    return 0
  fi
  if [[ -f "$ROOT/api/dist/main.js" ]]; then
    echo "==> no pm2/systemd — trying pkill + node dist"
    pkill -f 'node.*dist/main' 2>/dev/null || true
    sleep 1
    (cd "$ROOT/api" && nohup node dist/main.js >>/var/log/qulay-ish-api.log 2>&1 &)
    return 0
  fi
  echo "ERROR: API process ni restart qila olmadim (pm2/systemd yo'q)."
  return 1
}

restart_api

echo "==> Smoke checks → $PROD_HOST"
sleep 2
STATUS="$(curl -sS --connect-timeout 8 "https://$PROD_HOST/api/auth/sms-status" || true)"
echo "sms-status: $STATUS"
if echo "$STATUS" | grep -q '"configured":true'; then
  echo "OK: Production DevSMS token yuklangan"
else
  echo "WARN: sms-status configured!=true — token/restart tekshiring"
fi

HDR="$(curl -sI -X OPTIONS "https://$PROD_HOST/api/auth/send-otp" \
  -H 'Origin: https://ishliayol.uz' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' || true)"
if echo "$HDR" | grep -qi 'Access-Control-Allow-Origin: https://ishliayol.uz'; then
  echo "OK: CORS https://ishliayol.uz"
else
  echo "WARN: CORS — API eski jarayon bo'lishi mumkin"
fi

echo "Done."
