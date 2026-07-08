/**
 * Locked state (Sprint 018) — shown when an org's plan doesn't include
 * Performance Review (Starter). Server-side enforcement is separate; this is the
 * upgrade path in the UI.
 */

import Link from "next/link";
import { buttonClasses, Card, PageHeader } from "@/components/ui";

export function PerformanceLocked() {
  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title="Performance Review"
        description="Measure how well your AI Employees handle real situations — and watch quality climb as you refine them."
      />
      <Card className="mt-6 p-8 text-center">
        <h2 className="text-lg font-semibold text-taurus-text">A Growth feature</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-taurus-sub">
          Performance Review lets you score an AI Employee against real situations, see exactly where
          it does well, and track improvement over time. It&apos;s available on the Growth and Scale
          plans.
        </p>
        <div className="mt-6">
          <Link href="/dashboard/settings/billing/plans" className={buttonClasses("primary")}>
            See Growth plans
          </Link>
        </div>
      </Card>
    </div>
  );
}
