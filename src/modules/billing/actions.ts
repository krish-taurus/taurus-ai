"use server";

/**
 * Billing server actions (Prompt 011).
 *
 * SECURITY: authentication + organization are resolved server-side via
 * requireCurrentOrganization(); the organizationId is never taken from the
 * client. Managing billing (upgrade/downgrade/cancel/open portal) re-checks the
 * billing.manage permission before doing anything, so client gating is never
 * trusted on its own. Only a catalog plan id is accepted from the client.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { getClientEnv } from "@/lib/env/env";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { choosePlanSchema } from "@/modules/billing/schema";
import { getBillingProvider } from "@/modules/billing/providers";
import { openBillingPortal, startPlanChange } from "@/modules/billing/service";

export interface BillingActionState {
  error?: string;
}

const BILLING_PATH = "/dashboard/settings/billing";
const PLANS_PATH = "/dashboard/settings/billing/plans";

function baseUrl(): string {
  return getClientEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

/** Choose / change plan — simulated upgrade or Stripe Checkout redirect. */
export async function choosePlanAction(
  _prevState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();

  if (!hasPermission(membership.role, "billing.manage")) {
    return { error: "You do not have permission to change the plan for this organization." };
  }

  const parsed = choosePlanSchema.safeParse({ planId: formData.get("planId") });
  if (!parsed.success) {
    return { error: "Please choose a valid plan." };
  }

  let redirectTo: string;
  try {
    const result = await startPlanChange(
      getStore(),
      { organizationId: organization.id, userId: user.id },
      getBillingProvider(),
      parsed.data.planId,
      {
        successUrl: `${baseUrl()}${BILLING_PATH}?checkout=success`,
        cancelUrl: `${baseUrl()}${PLANS_PATH}?checkout=canceled`,
      },
    );
    redirectTo = result.kind === "redirect" ? result.url : `${BILLING_PATH}?upgrade=success`;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update your plan." };
  }

  revalidatePath(BILLING_PATH);
  revalidatePath(PLANS_PATH);
  revalidatePath("/dashboard");
  redirect(redirectTo);
}

/** Open the billing portal (Stripe) or return to billing in simulated mode. */
export async function manageBillingAction(
  _prevState: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  void _formData;
  const { organization, membership } = await requireCurrentOrganization();

  if (!hasPermission(membership.role, "billing.manage")) {
    return { error: "You do not have permission to manage billing for this organization." };
  }

  let redirectTo: string;
  try {
    const result = await openBillingPortal(
      getStore(),
      organization.id,
      getBillingProvider(),
      `${baseUrl()}${BILLING_PATH}`,
    );
    redirectTo = result.kind === "redirect" ? result.url : `${BILLING_PATH}?portal=simulated`;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not open billing management." };
  }

  redirect(redirectTo);
}
