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
  unpublishListing,
  type MarketplaceActor,
} from "@/modules/marketplace/service";

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

  let listingId: string;
  try {
    const listing = await publishListing(getStore(), ctx.actor, {
      employeeId: String(formData.get("employeeId") ?? ""),
      title: (formData.get("title") as string) || undefined,
      headline: (formData.get("headline") as string) || undefined,
      summary: (formData.get("summary") as string) || undefined,
      includeVaults: formData.get("includeVaults") === "on",
    });
    listingId = listing.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not publish this agent." };
  }

  revalidatePath("/dashboard/marketplace");
  redirect(`/dashboard/marketplace/${listingId}`);
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
