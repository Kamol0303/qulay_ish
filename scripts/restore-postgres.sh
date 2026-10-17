#!/bin/sh
# Restore a custom-format dump into DATABASE_URL.
# Refuses the production host. This replaces objects in the target database.
set -eu

if [ -z "${DATABASE_URL:-}" ] || [ -z "${1:-}" ]; then
  echo "Usage: DATABASE_URL=... ./scripts/restore-postgres.sh backup.dump" >&2
  exit 1
fi

case "$DATABASE_URL" in
  *185.203.237.57*)
    echo "Refusing to restore onto the production host." >&2
    exit 1
    ;;
esac

pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$1"
echo "Restore finished"
