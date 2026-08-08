#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Defaults (can be overridden via env or script args)
DEFAULT_SUPER_PHONE="+998900707081"
DEFAULT_SUPER_PASS="Kamxush11"

SUPER_PHONE="${SUPER_ADMIN_PHONE:-${1:-$DEFAULT_SUPER_PHONE}}"
SUPER_PASS="${SUPER_ADMIN_PASSWORD:-${2:-$DEFAULT_SUPER_PASS}}"

echo "Updating local env files with Super Admin credentials (local only)"

upsert() {
  key="$1"
  val="$2"
  file="$3"
  if [ -f "$file" ]; then
    if grep -qE "^${key}=" "$file"; then
      sed -i.bak "s#^${key}=.*#${key}=${val}#" "$file" && rm -f "${file}.bak"
    else
      echo "${key}=${val}" >> "$file"
    fi
  else
    echo "${key}=${val}" > "$file"
  fi
}

# Root frontend env
upsert "VITE_SUPER_ADMIN_PHONE" "$SUPER_PHONE" ".env"
upsert "VITE_SUPER_ADMIN_PASSWORD" "$SUPER_PASS" ".env"

# API env
mkdir -p api
upsert "SUPER_ADMIN_PHONE" "$SUPER_PHONE" "api/.env"
upsert "SUPER_ADMIN_PASSWORD" "$SUPER_PASS" "api/.env"

echo "Starting full dev stack..."
exec bash "scripts/dev-stack.sh"
