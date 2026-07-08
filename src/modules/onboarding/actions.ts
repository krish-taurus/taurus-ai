"use server";

/**
 * Onboarding server actions (Sprint 020) — dismiss / resume the activation
 * checklist. The organization is always resolved from the session (never the
 * client), so a member can only change their own org's state. Both actions are
 * audited and revalidate the dashboard.
 */

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";

async function setDismissed(dismissed: boolean, action: string): Promise<void> {
  const { organization, user } = await requireCurrentOrganization();
  const store = getStore();
  await store.setOnboardingDismissed(organization.id, dismissed, user.id);
  await store.createAuditEvent({
    organizationId: organization.id,
    actorType: "user",
    actorId: user.id,
    action,
  });
  revalidatePath("/dashboard");
}

/** Hide the activation checklist for the organization (resumable). */
export async function dismissOnboardingAction(): Promise<void> {
  await setDismissed(true, "onboarding.dismissed");
}

/** Bring the activation checklist back after it was dismissed. */
export async function resumeOnboardingAction(): Promise<void> {
  await setDismissed(false, "onboarding.resumed");
}
