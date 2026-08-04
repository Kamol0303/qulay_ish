#!/usr/bin/env bash
# Starts Postgres (if needed) + API + Frontend together.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-3000}"

echo "=== ishliayol.uz — full stack ==="

# 1) Database
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "→ PostgreSQL yo'q. db:setup ishga tushirilmoqda..."
  bash "$ROOT/scripts/setup-db.sh"
else
  echo "✓ PostgreSQL ishlayapti"
  if [[ -f "$ROOT/api/.env" ]]; then
    (cd "$ROOT/api" && npx prisma migrate deploy >/dev/null)
  fi
fi

# 2) Stop leftover listeners on our ports (dev only)
for port in "$API_PORT" "$WEB_PORT"; do
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi
done

cleanup() {
  echo ""
  echo "To'xtatilmoqda..."
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" >/dev/null 2>&1 || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" >/dev/null 2>&1 || true
  wait >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ API: http://localhost:${API_PORT}/api"
(cd "$ROOT/api" && npm run start:dev) &
API_PID=$!

# Wait for API
for i in $(seq 1 40); do
  if curl -sf "http://localhost:${API_PORT}/api/stats/counts" >/dev/null 2>&1; then
    echo "✓ API tayyor"
    break
  fi
  if ! kill -0 "$API_PID" >/dev/null 2>&1; then
    echo "✗ API ishga tushmadi. Yuqoridagi API logini tekshiring."
    exit 1
  fi
  sleep 1
done

echo "→ Frontend: http://localhost:${WEB_PORT}"
npm run dev &
WEB_PID=$!

echo ""
echo "=== Ikkala server ishlayapti ==="
echo "  Frontend: http://localhost:${WEB_PORT}"
echo "  API:      http://localhost:${API_PORT}/api"
echo "To'xtatish: Ctrl+C"
echo ""

wait
