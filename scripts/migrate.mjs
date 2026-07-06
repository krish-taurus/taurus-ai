// ---------------------------------------------------------------------------
// Taurus AI — minimal migration runner (Prompt 002)
//
// Applies every .sql file in db/migrations in lexical order against DATABASE_URL,
// tracking applied files in a schema_migrations table so it is safe to re-run.
//
// Usage:
//   node scripts/migrate.mjs           # apply pending migrations
//   node scripts/migrate.mjs --seed    # also apply db/seed.sql afterwards
//
// Requires DATABASE_URL to be set (see .env.example). No secrets are hardcoded.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "db", "migrations");
const seedFile = join(__dirname, "..", "db", "seed.sql");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Configure it in .env.local before running migrations.");
  process.exit(1);
}

const shouldSeed = process.argv.includes("--seed");

const client = new pg.Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  await client.query(
    `create table if not exists schema_migrations (
       filename text primary key,
       applied_at timestamptz not null default now()
     )`,
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rowCount } = await client.query("select 1 from schema_migrations where filename = $1", [
      file,
    ]);
    if (rowCount > 0) {
      console.log(`= skip   ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [file]);
      await client.query("commit");
      console.log(`+ apply  ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }

  if (shouldSeed) {
    const sql = readFileSync(seedFile, "utf8");
    await client.query(sql);
    console.log("+ seed   db/seed.sql");
  }

  console.log("Migrations complete.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
