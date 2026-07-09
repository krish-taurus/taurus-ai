"use server";

/**
 * Marketplace server actions (Sprint 030).
 *
 * SECURITY: authentication + organization are resolved server-side via
 * requireCurrentOrganization(); organizationId is never taken from the client.
 * Publishing/approving require employee.manage; requesting a hire requires
 * employee.create (it creates an employee in the caller's org).
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission, type Permission } from "@/modules/organizations/roles";
import {
  approveHire,
  declineHire,
  publishListing,
  requestHire,
  submitReview,
  unpublishListing,
  type MarketplaceActor,
  type VaultDescriber,
} from "@/modules/marketplace/service";
import { generateListingCopy, generateVaultDescription } from "@/modules/marketplace/generation";

export interface MarketplaceActionState {
  error?: string;
}

async function requirePermission(
  permission: Permission,
): Promise<{ ok: true; actor: MarketplaceActor } | { ok: false }> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, permission)) return { ok: false };
  return { ok: true, actor: { organizationId: organization.id, userId: user.id } };
}

const DENIED = "You do not have permission to do that in this organization.";

export async function publishListingAction(
  _prev: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const ctx = await requirePermission("employee.manage");
  if (!ctx.ok) return { error: DENIED };

  const employeeId = String(formData.get("employeeId") ?? "");
  const includeVaults = formData.get("includeVaults") === "on";
  const autoDescribeVaults = formData.get("autoDescribeVaults") === "on";

  let listingId: string;
  try {
    // Optionally let the AI writer fill in vault descriptions during publish.
    let describeVault: VaultDescriber | undefined;
    if (includeVaults && autoDescribeVaults) {
      const published = await getStore().getPublishedEmployeeDna(ctx.actor.organizationId, employeeId);
      const roleSummary = published?.dna.identity.roleSummary ?? "";
      describeVault = (vaultName) =>
        generateVaultDescription(getStore(), {
          organizationId: ctx.actor.organizationId,
          employeeId,
          roleSummary,
          vaultName,
        });
    }

    const listing = await publishListing(
      getStore(),
      ctx.actor,
      {
        employeeId,
        title: (formData.get("title") as string) || undefined,
        headline: (formData.get("headline") as string) || undefined,
        summary: (formData.get("summary") as string) || undefined,
        includeVaults,
      },
      { describeVault },
    );
    listingId = listing.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not publish this AI Employee." };
  }

  revalidatePath("/dashboard/marketplace");
  redirect(`/dashboard/marketplace/${listingId}`);
}

/** Generate resume headline + summary with AI. Called directly from the form. */
export async function generateListingCopyAction(
  employeeId: string,
): Promise<{ headline?: string; summary?: string; error?: string }> {
  const ctx = await requirePermission("employee.manage");
  if (!ctx.ok) return { error: DENIED };
  try {
    const copy = await generateListingCopy(getStore(), {
      organizationId: ctx.actor.organizationId,
      employeeId,
    });
    return { headline: copy.headline, summary: copy.summary };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not generate copy." };
  }
}

export async function unpublishListingAction(
  _prev: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const ctx = await requirePermission("employee.manage");
  if (!ctx.ok) return { error: DENIED };
  try {
    await unpublishListing(getStore(), ctx.actor, String(formData.get("listingId") ?? ""));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not unpublish this listing." };
  }
  revalidatePath("/dashboard/marketplace");
  redirect("/dashboard/marketplace/listings");
}

export async function requestHireAction(
  _prev: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const ctx = await requirePermission("employee.create");
  if (!ctx.ok) return { error: DENIED };
  const listingId = String(formData.get("listingId") ?? "");
  try {
    await requestHire(getStore(), ctx.actor, {
      listingId,
      note: (formData.get("note") as string) || undefined,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send the hire request." };
  }
  revalidatePath(`/dashboard/marketplace/${listingId}`);
  redirect(`/dashboard/marketplace/${listingId}?requested=1`);
}

export async function submitReviewAction(
  _prev: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const ctx = await requirePermission("employee.create");
  if (!ctx.ok) return { error: DENIED };
  const listingId = String(formData.get("listingId") ?? "");
  try {
    await submitReview(getStore(), ctx.actor, {
      listingId,
      rating: Number(formData.get("rating") ?? 0),
      comment: (formData.get("comment") as string) || undefined,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not submit your review." };
  }
  revalidatePath(`/dashboard/marketplace/${listingId}`);
  redirect(`/dashboard/marketplace/${listingId}?reviewed=1`);
}

export async function approveHireAction(
  _prev: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const ctx = await requirePermission("employee.manage");
  if (!ctx.ok) return { error: DENIED };
  try {
    await approveHire(getStore(), ctx.actor, String(formData.get("hireId") ?? ""));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not approve this request." };
  }
  revalidatePath("/dashboard/marketplace/requests");
  redirect("/dashboard/marketplace/requests");
}

export async function declineHireAction(
  _prev: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const ctx = await requirePermission("employee.manage");
  if (!ctx.ok) return { error: DENIED };
  try {
    await declineHire(getStore(), ctx.actor, String(formData.get("hireId") ?? ""));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not decline this request." };
  }
  revalidatePath("/dashboard/marketplace/requests");
  redirect("/dashboard/marketplace/requests");
}
