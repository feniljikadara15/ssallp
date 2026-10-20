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
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
  return { query: async (text, params) => (await pool.query(text, params as any[])).rows };
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
