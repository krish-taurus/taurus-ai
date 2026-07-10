/**
 * Production readiness check (Sprint 044).
 *
 * Usage:  npx tsx scripts/check-env.ts [--force]
 *   npm run check:prod
 *
 * Prints blockers + warnings for the current environment and exits non-zero if
 * any blocker is present — run it as a deploy/predeploy step so a misconfigured
 * production deploy fails loudly instead of silently downgrading. Pass --force to
 * apply production rules even when NODE_ENV is not "production".
 */

import {
  checkProductionReadiness,
  formatReadinessReport,
} from "@/lib/env/readiness";

const force = process.argv.includes("--force");
const report = checkProductionReadiness(process.env, { force });

console.log(formatReadinessReport(report));

if (report.production && report.blockers.length > 0) {
  console.error(`\nFAILED: ${report.blockers.length} production blocker(s) must be resolved before going live.`);
  process.exit(1);
}
process.exit(0);
