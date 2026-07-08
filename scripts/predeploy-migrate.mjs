// ---------------------------------------------------------------------------
// Taurus AI — deploy-time migration step (Sprint 020 follow-up)
//
// Applies database migrations as part of the build so a deploy tends to bring
// the schema with it (the class of failure that took production down after
// Sprint 020 added organization_onboarding). Wired into the Vercel Build Command
// via vercel.json.
//
// Design goals learned the hard way:
//   1. Never block a deploy. A migration hiccup (unreachable DB, a provider that
//      lacks an extension, a transient error) must NOT freeze deploys. The app
//      already degrades gracefully when a table is missing, so a delayed
//      migration is far better than a frozen pipeline. On failure we log loudly
//      and let the build proceed; run `npm run db:migrate` manually to recover.
//   2. Production only. Preview and development builds must never run migrations
//      against a database (they may share the production connection string).
//   3. No database, no-op. Builds without DATABASE_URL (in-memory store) skip.
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.log("predeploy-migrate: no DATABASE_URL set — skipping migrations.");
  process.exit(0);
}

// VERCEL_ENV is "production" | "preview" | "development" during a Vercel build.
// When unset (e.g. a local/manual build) we proceed. Only skip for non-production
// Vercel builds so previews never touch the database.
const vercelEnv = process.env.VERCEL_ENV;
if (vercelEnv && vercelEnv !== "production") {
  console.log(`predeploy-migrate: VERCEL_ENV=${vercelEnv} — skipping (production only).`);
  process.exit(0);
}

console.log("predeploy-migrate: applying database migrations…");
const result = spawnSync("node", [join(__dirname, "migrate.mjs")], { stdio: "inherit" });

if (result.status !== 0) {
  console.error(
    "predeploy-migrate: WARNING — migrations did not complete. The deploy will " +
      "proceed (the app degrades gracefully if a table is missing). Run " +
      "`DATABASE_URL=<prod> npm run db:migrate` manually to finish.",
  );
}

// Always succeed: never block the build on the migration step.
process.exit(0);
