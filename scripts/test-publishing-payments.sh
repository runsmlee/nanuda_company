#!/usr/bin/env bash
# Reproducible integration test: isolated PostgreSQL, real migrations/code, blocked external mutations.
set -euo pipefail
for command in initdb pg_ctl psql createdb pnpm; do
  command -v "$command" >/dev/null || { echo "Required: $command" >&2; exit 1; }
done
if pg_isready -h 127.0.0.1 -p 55439 >/dev/null 2>&1; then
  echo "Test port 55439 is already occupied; no existing database was modified." >&2
  exit 1
fi
payment_test_dir=$(mktemp -d /tmp/nanuda-payment-tests.XXXXXX)
cleanup() {
  pg_ctl -D "$payment_test_dir/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$payment_test_dir"
}
trap cleanup EXIT
initdb -D "$payment_test_dir/data" -A trust -U postgres > "$payment_test_dir/init.log"
pg_ctl -D "$payment_test_dir/data" -l "$payment_test_dir/server.log" -o '-p 55439 -h 127.0.0.1' start >/dev/null
psql -h 127.0.0.1 -p 55439 -U postgres -v ON_ERROR_STOP=1 -c 'create role anon; create role authenticated; create role service_role bypassrls;' >/dev/null
createdb -h 127.0.0.1 -p 55439 -U postgres nanuda_payment_test
psql -h 127.0.0.1 -p 55439 -U postgres -d nanuda_payment_test -v ON_ERROR_STOP=1 -c 'create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);' >/dev/null
for migration in supabase/migrations/*.sql; do
  psql -h 127.0.0.1 -p 55439 -U postgres -d nanuda_payment_test -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done
if [[ "${1:-}" == "--sandbox" ]]; then
  shift
  pnpm exec tsx --env-file=.env.local scripts/tests/payment-sandbox.ts "$@"
else
  pnpm exec tsx --test scripts/tests/payment-reliability.test.ts
fi
