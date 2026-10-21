#!/usr/bin/env bash
# Copies the Retool DB (tables and data) into an empty Supabase database, then
# turns on row level security so Supabase's public REST API can't read it.
#
# Usage:
#   RETOOL_DB_URL='postgresql://...retool...'  \
#   SUPABASE_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
#   bash scripts/copy-retool-to-supabase.sh
#
# Run it BEFORE the app first connects to Supabase (the app creates empty tables
# on first connection, and this copy expects an empty database). Use Supabase's
# direct connection (port 5432) here, not the pooler. Needs pg_dump/psql 16+.
set -euo pipefail
: "${RETOOL_DB_URL:?Set RETOOL_DB_URL}"
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL}"

existing=$(psql "$SUPABASE_DB_URL" -Atc "SELECT to_regclass('public.orders') IS NOT NULL")
if [ "$existing" = "t" ]; then
  echo "Supabase already has an orders table. Empty the public schema first, or the copy will clash." >&2
  exit 1
fi

echo "Copying tables and data from Retool DB..."
pg_dump "$RETOOL_DB_URL" --schema=public --no-owner --no-privileges --no-comments \
  | grep -v '^CREATE SCHEMA public;$' \
  | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q

echo "Turning on row level security..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c "DO \$\$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP; END \$\$;"

echo "Row counts in Supabase:"
psql "$SUPABASE_DB_URL" -Atc "SELECT relname || ': ' || n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname"
echo "Done."
