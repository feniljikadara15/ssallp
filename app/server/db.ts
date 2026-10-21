import { config, isDemo } from "./config.js";
import { actorStore, AUDIT_SQL, isWrite, type Actor } from "./audit.js";

export type Row = Record<string, any>;

interface Driver {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  /** Runs one write in its own transaction, tagged with who made it for the audit trigger. */
  tagged(actor: Actor, text: string, params?: unknown[]): Promise<Row[]>;
}

const TAG_SQL = "SELECT set_config('app.actor', $1, true), set_config('app.ip', $2, true), set_config('app.device', $3, true), set_config('app.request', $4, true)";
const tagParams = (a: Actor) => [a.actor, a.ip, a.device, a.request];

let driver: Promise<Driver> | null = null;

async function connectPg(): Promise<Driver> {
  const { default: pg } = await import("pg");
  // Return NUMERIC/BIGINT as JS numbers and DATE as plain "YYYY-MM-DD" strings,
  // which is what Retool handed the UI.
  pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(1082, (v) => v);
  const needsSsl = !/localhost|127\.0\.0\.1/.test(config.databaseUrl) && !/sslmode=disable/.test(config.databaseUrl);
  const target = parseDatabaseUrl(config.databaseUrl);
  const pool = new pg.Pool({
    ...target,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 3,
    // Fail in seconds with a clear message instead of leaving pages loading.
    connectionTimeoutMillis: 10_000,
    query_timeout: 45_000,
  });
  pool.on("error", (e) => console.error("Idle database connection error:", e.message));
  const driver: Driver = {
    query: async (text, params) => (await pool.query(text, params as any[])).rows,
    tagged: async (actor, text, params) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(TAG_SQL, tagParams(actor));
        const rows = (await client.query(text, params as any[])).rows;
        await client.query("COMMIT");
        return rows;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => null);
        throw e;
      } finally {
        client.release();
      }
    },
  };
  try {
    await setUpEmptyDatabase(driver);
  } catch (e: any) {
    throw new Error(explainConnectionError(e));
  }
  return driver;
}

// Reads DATABASE_URL into connection settings. Passwords often contain "@",
// "#", "/" or "?" (e.g. Supabase's), which a strict URL parser misreads unless
// they are %-encoded; this accepts both forms. The host is taken after the LAST
// "@", so everything before it belongs to the user and password.
export function parseDatabaseUrl(raw: string) {
  const m = raw.trim().match(/^postgres(?:ql)?:\/\/([^:@]+)(?::(.*))?@([^@/?#:]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?(.*))?$/s);
  if (!m) throw new Error("DATABASE_URL isn't a postgresql:// connection string");
  const [, user, password = "", host, port, database, query] = m;
  const dec = (v: string) => { try { return decodeURIComponent(v); } catch { return v; } };
  const params = new URLSearchParams(query ?? "");
  return {
    user: dec(user),
    password: dec(password),
    host,
    port: port ? Number(port) : 5432,
    database: dec(database || "postgres"),
    ...(params.get("options") ? { options: params.get("options")! } : {}),
  };
}

function explainConnectionError(e: any) {
  const msg = String(e?.message ?? e);
  const host = (() => { try { return parseDatabaseUrl(config.databaseUrl).host; } catch { return ""; } })();
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(host))
    return `Can't connect to the database (${msg}). This is Supabase's Direct connection address, which Vercel can't reach. In Supabase click Connect, choose "Transaction pooler" and use that URI (port 6543) as DATABASE_URL.`;
  if (/password authentication failed/i.test(msg)) return `Database password is wrong in DATABASE_URL (${msg}).`;
  if (/timeout|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|ENETUNREACH/i.test(msg)) return `Can't reach the database at ${host || "DATABASE_URL"} (${msg}). Check DATABASE_URL; for Supabase use the Transaction pooler URI.`;
  return `Database error: ${msg}`;
}

// A brand-new database (for example a fresh Supabase project) gets the tables
// on first connection. A database that already has them, like the Retool DB,
// is left alone.
async function setUpEmptyDatabase(db: Driver) {
  const [{ ready }] = await db.query("SELECT to_regclass('public.orders') IS NOT NULL AS ready");
  if (ready) {
    await addMissingColumns(db);
    await installAudit(db);
    return seedIfRequested(db);
  }
  const { SCHEMA_SQL } = await import("./schemaSql.js");
  const { STATES } = await import("./demoSeed.js");
  await db.query(SCHEMA_SQL);
  // Supabase publishes the public schema through its REST API to anyone with
  // the anon key. Row level security with no policies closes that door; the
  // app connects as the database owner, which bypasses it.
  await db.query(`DO $$ DECLARE t text; BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP; END $$;`);
  await db.query(
    `INSERT INTO state_codes (state_name, code) SELECT * FROM UNNEST($1::text[], $2::text[])`,
    [STATES.map((s) => s[0]), STATES.map((s) => s[1])],
  );
  console.log("Created the OMS tables in an empty database");
  await seedIfRequested(db);
  await installAudit(db);
}

// Columns the Retool workflows write that databases created by earlier versions
// of this app lack. Adding nullable columns is a no-op on the Retool DB.
async function addMissingColumns(db: Driver) {
  await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount NUMERIC, ADD COLUMN IF NOT EXISTS tcs_status BOOLEAN, ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMPTZ;
    ALTER TABLE enquiry_items ADD COLUMN IF NOT EXISTS status TEXT;
    ALTER TABLE loading_slips ADD COLUMN IF NOT EXISTS regenerated_count INTEGER DEFAULT 0;`);
}

// The audit log is best-effort: a database user without the rights to add
// triggers still gets a working app, just without the history.
async function installAudit(db: Pick<Driver, "query">) {
  try { await db.query(AUDIT_SQL); } catch (e: any) { console.error("Audit log not installed:", e.message); }
}

// SEED_DEMO_DATA=true fills an EMPTY database (no customers, orders or
// products) with the demo sample data. It never touches a database with data.
async function seedIfRequested(db: Driver) {
  if (!/^(1|true|yes)$/i.test(process.env.SEED_DEMO_DATA ?? "")) return;
  const [{ empty }] = await db.query(
    "SELECT NOT EXISTS (SELECT 1 FROM customers) AND NOT EXISTS (SELECT 1 FROM orders) AND NOT EXISTS (SELECT 1 FROM products) AS empty",
  );
  if (!empty) return;
  const { demoSeedSql } = await import("./demoSeed.js");
  await db.query(demoSeedSql());
  console.log("Loaded demo sample data");
}

// Demo mode: an embedded Postgres (PGlite) seeded with sample data. It lives in
// memory, so changes last only as long as the server instance.
async function connectDemo(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { SCHEMA_SQL } = await import("./schemaSql.js");
  const { demoSeedSql } = await import("./demoSeed.js");
  const db = new PGlite({ parsers: { 1700: Number, 20: Number, 1082: (v: string) => v } });
  await db.exec(SCHEMA_SQL);
  await db.exec(demoSeedSql());
  await db.exec(AUDIT_SQL);
  return {
    query: async (text, params) => (await db.query<Row>(text, params as any[])).rows,
    tagged: (actor, text, params) => db.transaction(async (tx) => {
      await tx.query(TAG_SQL, tagParams(actor));
      return (await tx.query<Row>(text, params as any[])).rows;
    }),
  };
}

function getDriver() {
  if (!driver) {
    driver = isDemo() ? connectDemo() : connectPg();
    driver.catch(() => (driver = null));
  }
  return driver;
}

export async function q<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDriver();
  const actor = actorStore.getStore();
  return (actor && isWrite(text) ? await db.tagged(actor, text, params) : await db.query(text, params)) as T[];
}

export async function one<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(text, params))[0];
}

// Column lists per table, so code that writes rows the Retool workflows used to
// write only touches columns that exist in the connected database.
const columnCache = new Map<string, Set<string>>();
export async function columnsOf(table: string) {
  let cols = columnCache.get(table);
  if (!cols) {
    const rows = await q<{ column_name: string }>(
      // Generated columns (total_price in some databases) can't be written.
      "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND is_generated = 'NEVER'",
      [table],
    );
    cols = new Set(rows.map((r) => r.column_name));
    columnCache.set(table, cols);
  }
  return cols;
}

async function pick(table: string, data: Row) {
  const cols = await columnsOf(table);
  return Object.entries(data).filter(([k, v]) => cols.has(k) && v !== undefined);
}

export async function insertRow<T extends Row = Row>(table: string, data: Row, returning = "*"): Promise<T> {
  const entries = await pick(table, data);
  const sql = `INSERT INTO ${table} (${entries.map(([k]) => k).join(", ")}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING ${returning}`;
  return (await one<T>(sql, entries.map(([, v]) => v)))!;
}

export async function updateRow(table: string, idCol: string, id: unknown, data: Row) {
  const entries = await pick(table, data);
  if (!entries.length) return;
  const sql = `UPDATE ${table} SET ${entries.map(([k], i) => `${k} = $${i + 1}`).join(", ")} WHERE ${idCol} = $${entries.length + 1}`;
  await q(sql, [...entries.map(([, v]) => v), id]);
}
