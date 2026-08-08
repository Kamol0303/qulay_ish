#!/usr/bin/env bash
# Lokal .env / api/.env / .env.capacitor ni to'g'ri yozadi (eski fayllarni almashtiradi).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TOKEN="${DEVSMS_TOKEN:-df92767fd9141ca76a4d182eb93272b4832462d1a4a3eeac445f8cdef9f3f4c7}"
SA_PASS="${SUPER_ADMIN_PASSWORD:-Ka20030913!}"

cat > "$ROOT/.env" <<EOF
VITE_API_URL=/api
VITE_USE_EMULATOR=false
VITE_AI_MOCK_MODE=true
EOF

cat > "$ROOT/.env.capacitor" <<EOF
VITE_API_URL=https://ishliayol.uz/api
VITE_APP_URL=https://ishliayol.uz
VITE_AI_MOCK_MODE=false
VITE_USE_EMULATOR=false
EOF

cat > "$ROOT/api/.env" <<EOF
DATABASE_URL=postgresql://qulay_ish:qulay_ish_dev@localhost:5432/qulay_ish
JWT_SECRET=change-me-in-production-use-long-random
JWT_EXPIRES_IN=7d
API_PORT=4000
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,https://ishliayol.uz,https://www.ishliayol.uz,https://localhost,capacitor://localhost,capacitor://ishliayol.uz

SUPER_ADMIN_EMAIL=superadmin@ishliayol.uz
SUPER_ADMIN_PHONE=+998900707081
SUPER_ADMIN_PASSWORD=${SA_PASS}

DEVSMS_TOKEN=${TOKEN}
DEVSMS_BASE_URL=https://devsms.uz/api
DEVSMS_SERVICE_NAME=Mexrli Qollar
DEVSMS_DEV_MODE=false
EOF

echo "OK: .env, .env.capacitor, api/.env yozildi"
echo "  Frontend local API: /api"
echo "  APK API: https://ishliayol.uz/api"
echo "  DevSMS service: Mexrli Qollar (token api/.env da)"
echo ""
echo "Production VPS da ham api/.env ichiga XUDDI SHU DEVSMS_* ni qo'ying, keyin API restart."
