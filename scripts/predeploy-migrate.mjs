// ---------------------------------------------------------------------------
// Taurus AI — deploy-time migration step (Sprint 020 follow-up)
//
// Runs the database migrations as part of the build so a deploy can never serve
// code that expects a schema the database does not have (the class of failure
// that took production down after Sprint 020 added the organization_onboarding
// table). Wired into the Vercel Build Command via vercel.json.
//
// Behavior:
//   - No DATABASE_URL  -> skip quietly and succeed. Preview builds and the
//     in-memory-store setup have no database and need no migrations.
//   - DATABASE_URL set -> run scripts/migrate.mjs. If it fails, the build fails,
//     so a bad/unreachable schema blocks the deploy instead of shipping a broken
//     app. (Idempotent: already-applied migrations are skipped.)
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.log("predeploy-migrate: no DATABASE_URL set — skipping migrations.");
  process.exit(0);
}

console.log("predeploy-migrate: applying database migrations…");
const result = spawnSync("node", [join(__dirname, "migrate.mjs")], { stdio: "inherit" });

if (result.status !== 0) {
  console.error("predeploy-migrate: migrations failed — failing the build.");
  process.exit(result.status ?? 1);
}
