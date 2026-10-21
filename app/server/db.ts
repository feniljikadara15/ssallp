import { config, isDemo } from "./config.js";

export type Row = Record<string, any>;

interface Driver {
  query(text: string, params?: unknown[]): Promise<Row[]>;
}

let driver: Promise<Driver> | null = null;

async function connectPg(): Promise<Driver> {
  const { default: pg } = await import("pg");
  // Return NUMERIC/BIGINT as JS numbers and DATE as plain "YYYY-MM-DD" strings,
  // which is what Retool handed the UI.
  pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(1082, (v) => v);
  const needsSsl = !/localhost|127\.0\.0\.1/.test(config.databaseUrl) && !/sslmode=disable/.test(config.databaseUrl);
  // An sslmode in the URL would override the ssl option below, so drop it.
  const url = new URL(config.databaseUrl);
  url.searchParams.delete("sslmode");
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
  const driver: Driver = { query: async (text, params) => (await pool.query(text, params as any[])).rows };
  await setUpEmptyDatabase(driver);
  return driver;
}

// A brand-new database (for example a fresh Supabase project) gets the tables
// on first connection. A database that already has them, like the Retool DB,
// is left alone.
async function setUpEmptyDatabase(db: Driver) {
  const [{ ready }] = await db.query("SELECT to_regclass('public.orders') IS NOT NULL AS ready");
  if (ready) return;
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
  return { query: async (text, params) => (await db.query<Row>(text, params as any[])).rows };
}

function getDriver() {
  if (!driver) driver = isDemo() ? connectDemo() : connectPg();
  driver.catch(() => (driver = null));
  return driver;
}

export async function q<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await getDriver()).query(text, params)) as T[];
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
      "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1",
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
