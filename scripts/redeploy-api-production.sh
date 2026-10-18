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

ENV_FILE="$ROOT/api/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  mkdir -p /root/qulay-backup
  if [[ -f /root/qulay-backup/api.env ]]; then
    cp -a /root/qulay-backup/api.env "$ENV_FILE"
    echo "==> api/.env backupdan qaytarildi"
  else
    restored=""
    for old in /var/www/qulay-ish-eski-*/api/.env; do
      if [[ -f "$old" ]]; then
        cp -a "$old" "$ENV_FILE"
        restored="$old"
      fi
    done
    if [[ -z "$restored" ]]; then
      echo "ERROR: $ENV_FILE yo'q va backup ham yo'q."
      echo "  find /var /root /home -name '.env' -path '*/api/.env'"
      echo "  Topilgan faylni $ENV_FILE ga qo'ying. Bo'sh .env yozmang."
      exit 1
    fi
    echo "==> api/.env eski nusxadan qaytarildi: $restored"
  fi
fi

echo "==> git pull"
git pull origin main

echo "==> sayt build"
cd "$ROOT"
npm install --include=dev --no-fund --no-audit
npm run build

echo "==> api npm install + build"
cd "$ROOT/api"
npm install --include=dev --no-fund --no-audit
npx prisma generate
npx prisma migrate deploy
npm run build

if [[ ! -f "$ROOT/api/dist/main.js" ]]; then
  echo "ERROR: $ROOT/api/dist/main.js yo'q. API build tugamagan."
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
  echo "WARN: DEVSMS_TOKEN bo'sh — sayt ochiladi, OTP SMS ketmaydi."
else
  echo "==> DevSMS token bor"
fi

restart_api() {
  if command -v pm2 >/dev/null 2>&1; then
    echo "==> pm2 start"
    pm2 delete qulay-ish-api >/dev/null 2>&1 || true
    pm2 start "$ROOT/api/ecosystem.config.js" --update-env
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
  echo "==> pm2 yo'q — node dist"
  pkill -f 'node.*api/dist/main' 2>/dev/null || true
  sleep 1
  (cd "$ROOT/api" && NODE_ENV=production nohup node dist/main.js >>/var/log/qulay-ish-api.log 2>&1 &)
  return 0
}

restart_api

echo "==> Local health"
sleep 2
LOCAL="$(curl -sf --connect-timeout 8 "http://127.0.0.1:4000/api/health" || true)"
echo "local health: ${LOCAL:-yok}"
if ! echo "$LOCAL" | grep -q '"ok":true'; then
  echo "ERROR: API 4000 portda javob bermayapti."
  if command -v pm2 >/dev/null 2>&1; then
    pm2 status || true
    pm2 logs qulay-ish-api --lines 80 --nostream || true
  fi
  exit 1
fi

echo "==> Smoke checks → $PROD_HOST"
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
