/**
 * Employee readiness checklist (Prompt 007).
 *
 * Shown on the employee profile: is the Employee ready to chat? Uses StatusDot so
 * state reads without relying on color.
 */

import Link from "next/link";
import { StatusDot } from "@/components/ui";
import type { ChatReadiness } from "@/modules/employee-chat/readiness";

function ChecklistRow({
  done,
  label,
  hint,
  cta,
}: {
  done: boolean;
  label: string;
  hint: string;
  cta?: { text: string; href: string };
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-1">
          <StatusDot level={done ? 3 : 0} />
        </span>
        <div>
          <p className="text-sm font-medium text-taurus-text">{label}</p>
          <p className="text-xs text-taurus-faint">{hint}</p>
        </div>
      </div>
      {!done && cta ? (
        <Link
          href={cta.href}
          className="shrink-0 text-xs font-medium text-taurus-sub hover:text-taurus-text"
        >
          {cta.text}
        </Link>
      ) : null}
    </li>
  );
}

export function ReadinessChecklist({
  readiness,
  employeeId,
}: {
  readiness: ChatReadiness;
  employeeId: string;
}) {
  const brainReady = readiness.brainMode !== "unavailable";
  const brainHint =
    readiness.brainMode === "live"
      ? "A model provider is connected."
      : readiness.brainMode === "local_demo"
        ? "Using the local demo brain for testing."
        : "Connect a model provider in Model Hub.";

  return (
    <ul className="space-y-3">
      <ChecklistRow
        done={readiness.dnaPublished}
        label="Employee DNA published"
        hint={readiness.dnaPublished ? "Ready." : "Publish DNA so this AI Employee can respond."}
        cta={{ text: "Configure", href: `/dashboard/employees/${employeeId}/dna` }}
      />
      <ChecklistRow
        done={readiness.assignedKnowledgeCount > 0}
        label="Knowledge assigned"
        hint={
          readiness.assignedKnowledgeCount > 0
            ? `${readiness.assignedKnowledgeCount} source${readiness.assignedKnowledgeCount === 1 ? "" : "s"} assigned.`
            : "Assign Knowledge Vault sources for grounded answers."
        }
        cta={{ text: "Assign", href: `/dashboard/employees/${employeeId}/knowledge` }}
      />
      <ChecklistRow
        done={brainReady}
        label="Employee Brain configured"
        hint={brainHint}
        cta={{ text: "Open Model Hub", href: `/dashboard/settings/models` }}
      />
    </ul>
  );
}
