// ---------------------------------------------------------------------------
// Taurus AI — destructive database reset (Sprint 020 follow-up)
//
// Drops every table in the public schema and re-applies the full migration chain
// from scratch, producing a clean, consistent schema. Use this to recover a
// database that has drifted into an inconsistent state (e.g. partial migrations),
// where `db:migrate` alone can't reconcile it.
//
// DESTRUCTIVE: every row in every table is deleted. Guarded twice — it refuses to
// run without an explicit confirmation flag AND prints the target host first.
//
// Usage:
//   DATABASE_URL=<url> node scripts/reset-db.mjs --force
//   (or set CONFIRM_RESET=yes instead of --force)
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const confirmed = process.argv.includes("--force") || process.env.CONFIRM_RESET === "yes";
if (!confirmed) {
  console.error(
    "Refusing to reset without confirmation. This DELETES ALL DATA.\n" +
      "Re-run with --force (or CONFIRM_RESET=yes) once you are sure.",
  );
  process.exit(1);
}

// Show the target host so an accidental run against the wrong database is obvious.
let host = "unknown";
try {
  host = new URL(databaseUrl).host;
} catch {
  /* ignore parse errors */
}

const client = new pg.Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  console.log(`reset-db: target = ${host}`);
  console.log("reset-db: dropping all tables in schema public…");

  // Drop every table (and dependent objects) without dropping the schema itself,
  // which is the most portable approach across managed Postgres providers.
  await client.query(`
    do $$
    declare r record;
    begin
      for r in (select tablename from pg_tables where schemaname = 'public') loop
        execute 'drop table if exists public.' || quote_ident(r.tablename) || ' cascade';
      end loop;
    end $$;
  `);

  const { rows } = await client.query(
    "select count(*)::int as n from pg_tables where schemaname = 'public'",
  );
  console.log(`reset-db: ${rows[0].n} tables remain (expected 0).`);
}

main()
  .then(() => {
    console.log("reset-db: re-applying migrations…");
    const result = spawnSync("node", [join(__dirname, "migrate.mjs")], { stdio: "inherit" });
    process.exitCode = result.status ?? 0;
  })
  .catch((err) => {
    console.error("reset-db failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
