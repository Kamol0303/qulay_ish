#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== mexrliqollar.uz — PostgreSQL sozlash ==="

wait_pg() {
  for i in $(seq 1 30); do
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
      echo "PostgreSQL tayyor (localhost:5432)"
      return 0
    fi
    sleep 1
  done
  return 1
}

start_with_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  echo "Docker orqali PostgreSQL ishga tushirilmoqda..."
  if docker compose version >/dev/null 2>&1; then
    docker compose up -d postgres
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose up -d postgres
  else
    return 1
  fi
  wait_pg
}

psql_as_postgres() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres "$@"
}

# libc yangilanganda template1 kollatsiyasi eskiradi va CREATE DATABASE yiqiladi.
refresh_collation() {
  psql_as_postgres -c "ALTER DATABASE postgres REFRESH COLLATION VERSION;" || true
  psql_as_postgres -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;" || true
}

ensure_local_database() {
  if ! command -v sudo >/dev/null 2>&1 || ! id postgres >/dev/null 2>&1; then
    return 0
  fi
  refresh_collation
  psql_as_postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='qulay_ish'" | grep -q 1 || \
    psql_as_postgres -c "CREATE USER qulay_ish WITH PASSWORD 'qulay_ish_dev' CREATEDB;"
  psql_as_postgres -c "ALTER USER qulay_ish WITH PASSWORD 'qulay_ish_dev' CREATEDB;"
  if ! psql_as_postgres -tc "SELECT 1 FROM pg_database WHERE datname='qulay_ish'" | grep -q 1; then
    psql_as_postgres -c "CREATE DATABASE qulay_ish OWNER qulay_ish;"
  fi
  psql_as_postgres -c "GRANT ALL PRIVILEGES ON DATABASE qulay_ish TO qulay_ish;"
}

start_with_apt() {
  if ! command -v apt-get >/dev/null 2>&1; then
    return 1
  fi
  echo "PostgreSQL o'rnatilmoqda (apt)..."
  sudo apt-get update -qq
  sudo apt-get install -y postgresql postgresql-contrib
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
  wait_pg
}

if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "PostgreSQL allaqachon ishlayapti."
else
  if start_with_docker; then
    echo "Docker orqali PostgreSQL ishga tushdi."
  elif start_with_apt; then
    echo "APT orqali PostgreSQL ishga tushdi."
  else
    echo ""
    echo "PostgreSQL ishga tushmadi."
    echo "Qo'lda: docker compose up -d postgres  YOKI  sudo apt install postgresql"
    exit 1
  fi
fi

ensure_local_database

if [[ ! -f api/.env ]]; then
  ./scripts/write-local-envs.sh
  echo "api/.env yaratildi (write-local-envs.sh orqali)"
fi

echo "Migratsiyalar qo'llanmoqda..."
cd api
npx prisma migrate deploy

echo ""
echo "=== Tayyor! Keyingi qadamlar ==="
echo "  1) API:    cd api && npm run start:dev"
echo "  2) Frontend: npm run dev"
echo "  OTP dev rejimda API terminalida: [DEV OTP] +998... → kod"
