#!/usr/bin/env bash
# One command: Postgres (if needed) → API ready → Vite.
# Avoids Vite ECONNREFUSED by never opening the web server until API is healthy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-3000}"

echo "=== mexrliqollar.uz — npm run dev ==="

ensure_postgres() {
  if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "✓ PostgreSQL ishlayapti"
    return 0
  fi
  echo "→ PostgreSQL yo'q. Sozlanmoqda (npm run db:setup)..."
  bash "$ROOT/scripts/setup-db.sh"
}

free_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti ":${port}" | xargs -r kill -9 >/dev/null 2>&1 || true
  fi
}

wait_api() {
  local i
  for i in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:${API_PORT}/api/stats/counts" >/dev/null 2>&1; then
      return 0
    fi
    if [[ -n "${API_PID:-}" ]] && ! kill -0 "$API_PID" >/dev/null 2>&1; then
      return 1
    fi
    sleep 1
  done
  return 1
}

ensure_postgres

if [[ ! -d "$ROOT/api/node_modules" ]]; then
  echo "→ api dependencies o'rnatilmoqda..."
  (cd "$ROOT/api" && npm install)
fi

if [[ ! -f "$ROOT/api/.env" && -f "$ROOT/api/.env.example" ]]; then
  cp "$ROOT/api/.env.example" "$ROOT/api/.env"
  echo "✓ api/.env yaratildi"
fi

(cd "$ROOT/api" && npx prisma migrate deploy >/dev/null)

# If API already healthy, reuse it
if curl -sf "http://127.0.0.1:${API_PORT}/api/stats/counts" >/dev/null 2>&1; then
  echo "✓ API allaqachon ishlayapti (:${API_PORT})"
  API_PID=""
else
  free_port "$API_PORT"
  echo "→ API ishga tushirilmoqda (http://localhost:${API_PORT}/api) ..."
  (cd "$ROOT/api" && npm run start:dev) &
  API_PID=$!

  if ! wait_api; then
    echo ""
    echo "✗ API ishga tushmadi."
    echo "  1) npm run db:setup"
    echo "  2) cd api && npm install && npm run start:dev"
    echo "  Keyin xato logini yuqoridan ko'ring."
    [[ -n "${API_PID}" ]] && kill "$API_PID" >/dev/null 2>&1 || true
    exit 1
  fi
  echo "✓ API tayyor"
fi

cleanup() {
  echo ""
  echo "To'xtatilmoqda..."
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" >/dev/null 2>&1 || true
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" >/dev/null 2>&1 || true
  # Also stop children of nest --watch
  if [[ -n "${API_PID:-}" ]]; then
    pkill -P "$API_PID" >/dev/null 2>&1 || true
  fi
  wait >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

free_port "$WEB_PORT"
echo "→ Frontend: http://localhost:${WEB_PORT}"
# SKIP_API: API allaqachon yoqilgan — Vite qayta spawn qilmasin
SKIP_API=1 npx vite --port="$WEB_PORT" --host=0.0.0.0 &
WEB_PID=$!

echo ""
echo "=== Tayyor (ECONNREFUSED bo'lmasligi kerak) ==="
echo "  Frontend: http://localhost:${WEB_PORT}"
echo "  API:      http://localhost:${API_PORT}/api"
echo "To'xtatish: Ctrl+C"
echo ""

wait "$WEB_PID"
