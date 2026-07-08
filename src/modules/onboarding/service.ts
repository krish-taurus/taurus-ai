/**
 * Onboarding service (Sprint 020).
 *
 * Derives the first-run activation state entirely from real organization data —
 * there is no parallel per-step flag to drift. The only persisted state is the
 * dismissal / completion record (see DataStore.getOnboardingProgress). Strictly
 * organization-scoped: every read is keyed by the caller's organization id.
 */

import type { DataStore } from "@/lib/db/store";
import type { Role, Permission } from "@/modules/organizations/roles";
import { hasPermission } from "@/modules/organizations/roles";
import { ONBOARDING_STEPS, type OnboardingStepDef, type OnboardingStepKey } from "./steps";

export interface OnboardingContext {
  organizationId: string;
  userId: string;
  role: Role;
}

export interface OnboardingStepView extends OnboardingStepDef {
  done: boolean;
  /** Where to go to act on this step, or null if the actor cannot act yet. */
  href: string | null;
  /** Whether the current role holds the permission to perform this step. */
  canAct: boolean;
}

export interface OnboardingState {
  steps: OnboardingStepView[];
  /** Required (non-optional) steps. */
  requiredTotal: number;
  requiredDone: number;
  /** True once every required step is complete. */
  complete: boolean;
  /** True if the org has dismissed the checklist (still resumable). */
  dismissed: boolean;
  /** True once the completion milestone has already been recorded. */
  completionRecorded: boolean;
  /** The first employee, used to build per-employee step links. */
  firstEmployeeId: string | null;
}

function can(role: Role, permission: Permission): boolean {
  return hasPermission(role, permission);
}

/**
 * Read the onboarding progress record, tolerating the case where the Sprint 020
 * migration has not been applied yet (missing table). A read failure degrades to
 * "no record" so the activation checklist never breaks the dashboard.
 */
async function readOnboardingProgress(store: DataStore, organizationId: string) {
  try {
    return await store.getOnboardingProgress(organizationId);
  } catch (error) {
    console.error("onboarding: could not read progress (is migration 0019 applied?)", error);
    return null;
  }
}

/**
 * Compute the activation state for an organization. Read-only: it never writes.
 * Completion is recorded separately via `recordOnboardingCompletion` so a plain
 * page render has no side effects until the milestone is genuinely reached.
 */
export async function getOnboardingState(
  store: DataStore,
  ctx: OnboardingContext,
): Promise<OnboardingState> {
  const { organizationId, role } = ctx;

  const [employees, knowledge, channels, progress] = await Promise.all([
    store.listEmployees(organizationId),
    store.getKnowledgeVaultOverview(organizationId),
    store.listEmployeeChannelsForOrganization(organizationId),
    // The onboarding table is a Sprint 020 addition. If its migration (0019) has
    // not been applied yet in a given environment, treat progress as absent
    // rather than letting the whole dashboard fail to render. The checklist still
    // derives correctly from real data; only dismissal/completion won't persist
    // until the migration runs.
    readOnboardingProgress(store, organizationId),
  ]);

  const firstEmployee = employees[0] ?? null;
  const firstEmployeeId = firstEmployee?.id ?? null;

  // "Given DNA" = any employee has a published DNA version. "Tested" = any
  // employee has at least one chat thread (a thread only exists once a message
  // has been sent). Both are checked across employees so the step reflects the
  // whole org, not just the first hire.
  const [dnaFlags, chatFlags] = await Promise.all([
    Promise.all(
      employees.map((e) => store.getPublishedEmployeeDna(organizationId, e.id)),
    ),
    Promise.all(
      employees.map((e) => store.getLatestEmployeeChatThreadForEmployee(organizationId, e.id)),
    ),
  ]);

  const doneByKey: Record<OnboardingStepKey, boolean> = {
    hire: employees.length > 0,
    dna: dnaFlags.some((d) => d !== null),
    knowledge: knowledge.total > 0,
    test_chat: chatFlags.some((t) => t !== null),
    // A web deployment = an active website widget or embedded frame.
    deploy_web: channels.some(
      (c) =>
        (c.channelType === "website_widget" || c.channelType === "iframe_embed") &&
        c.status === "active",
    ),
  };

  const hrefByKey: Record<OnboardingStepKey, string | null> = {
    hire: "/dashboard/hire",
    dna: firstEmployeeId ? `/dashboard/employees/${firstEmployeeId}/dna` : "/dashboard/hire",
    knowledge: "/dashboard/knowledge/new",
    test_chat: firstEmployeeId ? `/dashboard/employees/${firstEmployeeId}/chat` : "/dashboard/hire",
    deploy_web: firstEmployeeId
      ? `/dashboard/employees/${firstEmployeeId}/channels`
      : "/dashboard/hire",
  };

  const steps: OnboardingStepView[] = ONBOARDING_STEPS.map((def) => {
    const canAct = can(role, def.permission);
    return {
      ...def,
      done: doneByKey[def.key],
      canAct,
      href: canAct ? hrefByKey[def.key] : null,
    };
  });

  const required = steps.filter((s) => !s.optional);
  const requiredDone = required.filter((s) => s.done).length;
  const complete = requiredDone === required.length;

  return {
    steps,
    requiredTotal: required.length,
    requiredDone,
    complete,
    dismissed: progress?.dismissedAt != null,
    completionRecorded: progress?.completedAt != null,
    firstEmployeeId,
  };
}

/**
 * Record the completion milestone exactly once, emitting an audit event. Safe to
 * call on every complete render — `markOnboardingCompleted` keeps the first
 * timestamp, and we only audit when this call is the one that sets it.
 */
export async function recordOnboardingCompletion(
  store: DataStore,
  ctx: OnboardingContext,
): Promise<void> {
  try {
    const before = await store.getOnboardingProgress(ctx.organizationId);
    if (before?.completedAt != null) return;
    await store.markOnboardingCompleted(ctx.organizationId, ctx.userId);
    await store.createAuditEvent({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      action: "onboarding.completed",
      metadata: { requiredSteps: ONBOARDING_STEPS.filter((s) => !s.optional).length },
    });
  } catch (error) {
    // Recording the milestone must never break the dashboard render (e.g. before
    // migration 0019 is applied). It is a best-effort, idempotent side effect.
    console.error("onboarding: could not record completion milestone", error);
  }
}
