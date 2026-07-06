/**
 * Chat readiness gate (Prompt 007).
 *
 * Shown instead of the composer when an employee is not ready to chat. Friendly,
 * business language with a clear CTA — never technical AI terms.
 */

import Link from "next/link";
import { buttonClasses, EmptyState } from "@/components/ui";
import type { ChatBlockReason } from "@/modules/employee-chat/metadata";

const GATES: Record<
  ChatBlockReason,
  { title: string; description: string; cta: string; href: (id: string) => string }
> = {
  needs_dna: {
    title: "Publish Employee DNA before testing this AI Employee.",
    description:
      "Give this AI Employee a published working style, responsibilities, and boundaries.",
    cta: "Configure Employee DNA",
    href: (id) => `/dashboard/employees/${id}/dna`,
  },
  needs_model_hub: {
    title: "Configure Model Hub before running this AI Employee.",
    description: "Connect a model provider so this AI Employee can respond.",
    cta: "Open Model Hub",
    href: () => `/dashboard/settings/models`,
  },
  archived: {
    title: "This AI Employee is archived.",
    description: "Restore this AI Employee to chat with it again.",
    cta: "Back to profile",
    href: (id) => `/dashboard/employees/${id}`,
  },
  no_model: {
    title: "No Employee Brain is available yet.",
    description: "Check your Model Hub settings to make a model available.",
    cta: "Open Model Hub",
    href: () => `/dashboard/settings/models`,
  },
};

export function ChatReadinessGate({
  reason,
  employeeId,
}: {
  reason: ChatBlockReason;
  employeeId: string;
}) {
  const gate = GATES[reason];
  return (
    <EmptyState
      title={gate.title}
      description={gate.description}
      action={
        <Link href={gate.href(employeeId)} className={buttonClasses("primary", "lg")}>
          {gate.cta}
        </Link>
      }
    />
  );
}
