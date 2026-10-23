#!/usr/bin/env bash
# Copies the Retool DB (tables, data and ID counters) into Supabase, then turns
# on row level security so Supabase's public REST API can't read it.
#
# Usage (from the repo folder):
#   RETOOL_DB_URL='postgresql://...retooldb.com/retool?sslmode=require' \
#   SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
#   bash app/scripts/copy-retool-to-supabase.sh
#
# Use Supabase's Session pooler string (port 5432). A password with @ # / ? or %
# must be %-encoded in the URL (@ is %40, # is %23).
#
# If Supabase already has tables (the app creates them, with sample data), the
# script shows what is there and asks before deleting it. Retool DB is only read.
# Functions the target already has (newer Supabase projects add rls_auto_enable)
# are replaced rather than failing the copy.
# Needs pg_dump and psql at least as new as the Retool server (17 is safe).
set -euo pipefail
: "${RETOOL_DB_URL:?Set RETOOL_DB_URL}"
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL}"

COUNTS="SELECT table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
          FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"

echo "Checking connections..."
retool_ver=$(psql "$RETOOL_DB_URL" -Atc "SHOW server_version_num")
psql "$SUPABASE_DB_URL" -Atc "SELECT 1" >/dev/null
dump_ver=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
if [ "$dump_ver" -lt "${retool_ver:0:2}" ]; then
  echo "pg_dump $dump_ver is older than the Retool server (${retool_ver:0:2}). Install PostgreSQL ${retool_ver:0:2} or newer client tools." >&2
  exit 1
fi

existing=$(psql "$SUPABASE_DB_URL" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")
if [ "$existing" != "0" ]; then
  echo
  echo "Supabase already has these tables (rows):"
  psql "$SUPABASE_DB_URL" -Atc "$COUNTS" | sed 's/^/  /; s/|/: /'
  echo
  read -r -p "Type WIPE to delete them and copy Retool's data in their place: " answer
  [ "$answer" = "WIPE" ] || { echo "Stopped. Nothing was changed."; exit 1; }
  PGOPTIONS="-c client_min_messages=warning" psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c "DO \$\$ DECLARE r record; BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    END LOOP;
    FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
      EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', r.sequence_name);
    END LOOP;
  END \$\$; DROP FUNCTION IF EXISTS public.audit_row() CASCADE;"
  echo "Supabase tables deleted."
fi

echo "Copying tables and data from Retool DB (this only reads Retool)..."
pg_dump "$RETOOL_DB_URL" --schema=public --no-owner --no-privileges --no-comments --no-publications --no-subscriptions --no-security-labels \
  | grep -v -e '^CREATE SCHEMA public;$' -e '^COMMENT ON SCHEMA public' \
  | sed -e 's/^CREATE FUNCTION /CREATE OR REPLACE FUNCTION /' \
  | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -o /dev/null

echo "Turning on row level security..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c "DO \$\$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP; END \$\$;"

echo
echo "Rows per table, Retool -> Supabase:"
join -t'|' -a1 -a2 -e '-' -o 0,1.2,2.2 \
  <(psql "$RETOOL_DB_URL" -Atc "$COUNTS" | sort) \
  <(psql "$SUPABASE_DB_URL" -Atc "$COUNTS" | sort) \
  | awk -F'|' '{ printf "  %-28s %8s -> %8s%s\n", $1, $2, $3, ($2 == $3 ? "" : "   <-- differs") }'
echo
echo "Done. The app adds its audit log the next time it starts."
