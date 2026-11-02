#!/usr/bin/env bash
# Runs all migrations + SQL tests against a throwaway local PostgreSQL
# (no Supabase project or Docker required).
#   Usage: npm run test:db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PGTEST_PORT:-54329}"
WORK="$(mktemp -d)"
RUN=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$WORK"
  RUN=(runuser -u postgres --)
fi

cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("${RUN[@]}" "$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

echo "▸ Supabase stub"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "▸ migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

status=0
for f in "$ROOT"/supabase/tests/[1-9]*.sql; do
  echo "▸ test $(basename "$f")"
  if ! "${PSQL[@]}" -f "$f"; then status=1; fi
done

if [ $status -eq 0 ]; then echo "✔ all database tests passed"; else echo "✘ database tests failed"; fi
exit $status
