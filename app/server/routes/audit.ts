import { columnsOf, one, q } from "../db.js";
import { HttpError, num } from "../http.js";
import { route } from "../router.js";

// What a change did, in the reader's words. Soft deletes (is_active off, or an
// order or enquiry moved to status 5) count as deletes, and undoing them as restores.
const KIND = `CASE
  WHEN a.action = 'INSERT' THEN 'created'
  WHEN a.action = 'DELETE' THEN 'deleted'
  WHEN a.changed && ARRAY['is_active'] AND a.new_row ->> 'is_active' = 'false' THEN 'deleted'
  WHEN a.changed && ARRAY['order_status', 'enquiry_status'] AND COALESCE(a.new_row ->> 'order_status', a.new_row ->> 'enquiry_status') = '5' THEN 'deleted'
  WHEN a.changed && ARRAY['is_active'] AND a.new_row ->> 'is_active' = 'true' THEN 'restored'
  WHEN a.changed && ARRAY['order_status', 'enquiry_status'] AND COALESCE(a.old_row ->> 'order_status', a.old_row ->> 'enquiry_status') = '5' THEN 'restored'
  ELSE 'updated' END`;
const RESTORE_DAYS = 30;
const IST_DAY = "(a.at AT TIME ZONE 'Asia/Kolkata')::date";

route("GET", "/api/audit", async ({ query }) => {
  const f = (k: string) => query.get(k) || null;
  const params = [f("kind"), f("table"), f("actor"), f("record"), f("from"), f("to")];
  const where = `($1::text IS NULL OR ${KIND} = $1) AND ($2::text IS NULL OR a.table_name = $2)
    AND ($3::text IS NULL OR COALESCE(a.actor, 'system') = $3) AND ($4::text IS NULL OR a.record_id = $4)
    AND ($5::date IS NULL OR ${IST_DAY} >= $5::date) AND ($6::date IS NULL OR ${IST_DAY} <= $6::date)`;
  const limit = Math.min(Number(query.get("limit") ?? 500), 2000);
  const rows = await q(
    `SELECT a.audit_id, a.at, a.table_name, a.record_id, a.action, COALESCE(a.actor, 'system') AS actor, a.ip, a.device, a.request_id,
            a.changed, a.old_row, a.new_row, a.restored_at, a.restored_by, ${KIND} AS kind,
            (${KIND} = 'deleted' AND a.restored_at IS NULL AND a.at > NOW() - INTERVAL '${RESTORE_DAYS} days') AS restorable
       FROM audit_log a WHERE ${where} ORDER BY a.at DESC, a.audit_id DESC LIMIT ${limit}`, params);
  const [{ count }] = await q(`SELECT COUNT(*)::int AS count FROM audit_log a WHERE ${where}`, params);
  const facets = await q(`SELECT ARRAY(SELECT DISTINCT COALESCE(actor, 'system') FROM audit_log ORDER BY 1) AS actors,
                                 ARRAY(SELECT DISTINCT table_name FROM audit_log ORDER BY 1) AS tables`);
  return { rows, count, ...facets[0] };
});

route("POST", "/api/audit/:id/restore", async ({ params, user }) => {
  const a = await one(`SELECT a.*, ${KIND} AS kind FROM audit_log a WHERE a.audit_id = $1`, [num(params.id)]);
  if (!a) throw new HttpError(404, "Change not found");
  if (a.kind !== "deleted") throw new HttpError(400, "Only deletions can be restored");
  if (a.restored_at) throw new HttpError(400, "Already restored");
  if (Date.now() - new Date(a.at).getTime() > RESTORE_DAYS * 864e5) throw new HttpError(400, `Deletions can be restored for ${RESTORE_DAYS} days`);

  // The table name comes from the audit row; only real tables in this schema are touched.
  const t = String(a.table_name);
  const known = await one("SELECT 1 FROM pg_tables WHERE schemaname = current_schema() AND tablename = $1", [t]);
  if (!/^[a-z_][a-z0-9_]*$/.test(t) || !known) throw new HttpError(400, "Unknown table");
  const pk = (await one(`SELECT a.attname AS pk FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
                          WHERE i.indrelid = $1::regclass AND i.indisprimary`, [t]))?.pk as string | undefined;
  if (!pk) throw new HttpError(400, "This record type can't be restored");
  const current = await one(`SELECT * FROM ${t} WHERE ${pk}::text = $1`, [a.record_id]);

  if (a.action === "DELETE") {
    if (current) throw new HttpError(400, "A record with this number exists again, so it can't be restored");
    const cols = [...(await columnsOf(t))].filter((c) => c in a.old_row);
    await q(`INSERT INTO ${t} (${cols.join(", ")}) SELECT ${cols.join(", ")} FROM jsonb_populate_record(NULL::${t}, $1::jsonb)`, [JSON.stringify(a.old_row)]);
  } else if (!current) {
    throw new HttpError(400, "The record no longer exists");
  } else if ((a.changed as string[]).includes("is_active") && a.new_row.is_active === false) {
    await q(`UPDATE ${t} SET is_active = TRUE, updated_at = NOW() WHERE ${pk}::text = $1`, [a.record_id]);
  } else {
    const col = "order_status" in a.old_row ? "order_status" : "enquiry_status";
    if (current[col] !== "5") throw new HttpError(400, "It has already been restored");
    await q(`UPDATE ${t} SET ${col} = $2, updated_at = NOW() WHERE ${pk}::text = $1`, [a.record_id, a.old_row[col]]);
  }
  await q("UPDATE audit_log SET restored_at = NOW(), restored_by = $2 WHERE audit_id = $1", [a.audit_id, user?.email ?? "system"]);
  return { message: "Restored" };
});
