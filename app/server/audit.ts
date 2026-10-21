import { AsyncLocalStorage } from "node:async_hooks";

// Who is making the current request. Every write the app makes runs in a
// short transaction that first copies this into app.* settings, which the
// audit_row() trigger reads, so each audit row names the person, their IP and
// device. Writes from elsewhere (Retool, the SQL editor) are logged with no actor.
export interface Actor { actor: string; ip: string; device: string; request: string }
export const actorStore = new AsyncLocalStorage<Actor>();

export const isWrite = (sql: string) => /\b(insert\s+into|update\s+[\w".]+\s+set|delete\s+from)\b/i.test(sql);

/** "Chrome on Windows", "Safari on iPhone": enough to tell devices apart. */
export function deviceOf(ua: string) {
  if (!ua) return "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /curl|node|python|axios/i.test(ua) ? "Script" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

// Installs the audit table and a row trigger on every table with a single
// column primary key. Safe to run on every start: tables that already have
// the trigger are skipped, so no locks are taken after the first run.
export const AUDIT_SQL = `
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL,
  actor TEXT,
  ip TEXT,
  device TEXT,
  request_id TEXT,
  old_row JSONB,
  new_row JSONB,
  changed TEXT[],
  restored_at TIMESTAMPTZ,
  restored_by TEXT
);
CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS audit_log_record_idx ON audit_log (table_name, record_id);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE o jsonb; n jsonb; ch text[];
BEGIN
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(k ORDER BY k) INTO ch FROM jsonb_object_keys(n) AS k
     WHERE k <> 'updated_at' AND (o -> k) IS DISTINCT FROM (n -> k);
    IF ch IS NULL THEN RETURN NULL; END IF;
  END IF;
  INSERT INTO audit_log (table_name, record_id, action, actor, ip, device, request_id, old_row, new_row, changed)
  VALUES (TG_TABLE_NAME, COALESCE(n, o) ->> TG_ARGV[0], TG_OP,
    NULLIF(current_setting('app.actor', true), ''), NULLIF(current_setting('app.ip', true), ''),
    NULLIF(current_setting('app.device', true), ''), NULLIF(current_setting('app.request', true), ''), o, n, ch);
  RETURN NULL;
END $fn$;

DO $do$ DECLARE r record; BEGIN
  FOR r IN
    SELECT c.oid, c.relname AS t, a.attname AS pk
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
     WHERE i.indisprimary AND i.indnatts = 1 AND c.relkind = 'r'
       AND ns.nspname = current_schema() AND c.relname <> 'audit_log'
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = r.oid AND tgname = 'audit_row') THEN
      EXECUTE format('CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row(%L)', r.t, r.pk);
    END IF;
  END LOOP;
END $do$;
`;
