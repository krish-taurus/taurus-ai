/**
 * Health + readiness endpoint (Sprint 044).
 *
 * GET /api/health
 *
 * Public, unauthenticated, safe for uptime monitors. Returns a terse readiness
 * status and issue counts (never secret values). Blocker/warning titles are
 * included to help an operator — they name missing config, not secrets.
 * Responds 503 when production has blockers so a load balancer / monitor can
 * flag a misconfigured deploy.
 */

import { NextResponse } from "next/server";
import {
  checkProductionReadiness,
  readinessStatus,
} from "@/lib/env/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = checkProductionReadiness();
  const status = readinessStatus(report);
  const httpStatus = status === "blocked" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      production: report.production,
      blockers: report.blockers.length,
      warnings: report.warnings.length,
      // Titles name missing configuration (not secrets) to aid diagnosis.
      issues: [...report.blockers, ...report.warnings].map((i) => ({
        code: i.code,
        severity: i.severity,
        title: i.title,
      })),
    },
    { status: httpStatus },
  );
}
