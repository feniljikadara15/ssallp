// Writes db/supabase-setup.sql: tables + row level security + demo sample data,
// ready to paste into Supabase → SQL Editor. Run: npx tsx scripts/gen-supabase-sql.ts
import { writeFileSync } from "node:fs";
import { SCHEMA_SQL } from "../server/schemaSql.js";
import { demoSeedSql } from "../server/demoSeed.js";

const rls = `DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP; END $$;`;

writeFileSync(
  new URL("../db/supabase-setup.sql", import.meta.url),
  `-- Sambhavnath OMS: tables + sample data for a new Supabase project.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run twice
-- (tables are created only if missing; sample rows are skipped if present).
-- Sample data is fictional. To start empty instead, run only up to the
-- "Sample data" line.

${SCHEMA_SQL}
-- Row level security with no policies: Supabase's REST API (anon key) can't
-- read these tables. The app connects as the database owner and isn't affected.
${rls}

-- Sample data
${demoSeedSql()}
`,
);
console.log("wrote db/supabase-setup.sql");
