#!/bin/sh
# Local or staging dump. Does not run against the production host unless
# FORCE_PROD_BACKUP=1 is set. Restore with scripts/restore-postgres.sh.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

case "$DATABASE_URL" in
  *185.203.237.57*)
    if [ "${FORCE_PROD_BACKUP:-}" != "1" ]; then
      echo "Refusing a dump of the production host. Set FORCE_PROD_BACKUP=1 to override." >&2
      exit 1
    fi
    ;;
esac

out="${1:-backup-$(date +%Y%m%d-%H%M%S).dump}"
pg_dump --format=custom --file="$out" "$DATABASE_URL"
echo "Wrote $out"
