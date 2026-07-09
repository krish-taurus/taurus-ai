/**
 * Inter-company AI Employee marketplace (Sprint 030).
 *
 * An organization publishes an employee as a public "listing" (a resume: its DNA
 * + a performance summary, and optionally descriptions of the vaults it uses).
 * Other organizations browse and "hire" it, which CLONES the DNA into the hirer's
 * org as a new employee — the seller's knowledge vault is never shared.
 *
 * SECURITY: a listing is a self-contained SNAPSHOT taken at publish time. The
 * public marketplace reads only the listing row (never the seller's live private
 * tables), and the DNA snapshot has its org-specific companyContext blanked, so
 * nothing outside the intended resume can cross organizations.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  MarketplaceListing,
  MarketplaceHire,
  PerformanceSnapshot,
  VaultSnapshotItem,
} from "@/lib/db/types";
import type { EmployeeDnaV1 } from "@/modules/employee-dna/schema";

export interface MarketplaceActor {
  organizationId: string;
  userId: string;
}

export class MarketplaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceError";
  }
}

function newPublicKey(): string {
  return `mk_${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Blank the org-specific companyContext so the snapshot is safe to publish and to
 * clone into another org (the hirer supplies their own company narrative).
 */
export function sanitizeDnaForMarketplace(dna: EmployeeDnaV1): EmployeeDnaV1 {
  return {
    ...dna,
    companyContext: {
      companyDescription: "",
      productsAndServices: "",
      targetCustomers: "",
      brandValues: [],
    },
  };
}

/** Build the performance summary shown on a resume, from completed review runs. */
export async function buildPerformanceSnapshot(
  store: DataStore,
  organizationId: string,
  employeeId: string,
): Promise<PerformanceSnapshot> {
  const runs = (await store.listReviewRuns(organizationId, { employeeId })).filter(
    (r) => r.status === "completed" && r.overallScore !== null,
  );
  if (runs.length === 0) {
    return { reviewCount: 0, bestScore: null, latestScore: null, passRate: null, trend: [] };
  }
  const scores = runs.map((r) => r.overallScore as number);
  const byDateDesc = [...runs].sort((a, b) =>
    (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
  );
  const totalPassed = runs.reduce((sum, r) => sum + (r.passedCases ?? 0), 0);
  const totalCases = runs.reduce((sum, r) => sum + (r.totalCases ?? 0), 0);
  const trend = [...runs]
    .sort((a, b) => a.dnaVersionNumber - b.dnaVersionNumber)
    .map((r) => ({
      dnaVersionNumber: r.dnaVersionNumber,
      overallScore: r.overallScore,
      completedAt: r.completedAt ?? "",
    }));
  return {
    reviewCount: runs.length,
    bestScore: Math.max(...scores),
    latestScore: byDateDesc[0].overallScore,
    passRate: totalCases > 0 ? totalPassed / totalCases : null,
    trend,
  };
}

/** Optional AI writer for a vault description, injected by the publish action. */
export type VaultDescriber = (vaultName: string) => Promise<string | null>;

/** Descriptions (never content) of the vaults an employee uses. */
async function buildVaultSnapshot(
  store: DataStore,
  organizationId: string,
  employeeId: string,
  describeVault?: VaultDescriber,
): Promise<VaultSnapshotItem[]> {
  const vaults = await store.listVaultsForEmployee(organizationId, employeeId);
  const items: VaultSnapshotItem[] = [];
  for (const v of vaults) {
    // Prefer the vault's own description; otherwise ask the AI writer (if given).
    const description = v.description ?? (describeVault ? await describeVault(v.name) : null);
    items.push({ name: v.name, description });
  }
  return items;
}

export interface PublishListingInput {
  employeeId: string;
  title?: string;
  headline?: string | null;
  summary?: string | null;
  includeVaults?: boolean;
}

/** Publish (or re-publish) an employee to the marketplace as a fresh snapshot. */
export async function publishListing(
  store: DataStore,
  actor: MarketplaceActor,
  input: PublishListingInput,
  opts?: { describeVault?: VaultDescriber },
): Promise<MarketplaceListing> {
  const employee = await store.getEmployee(actor.organizationId, input.employeeId);
  if (!employee) throw new MarketplaceError("This AI Employee could not be found.");

  const published = await store.getPublishedEmployeeDna(actor.organizationId, input.employeeId);
  if (!published) {
    throw new MarketplaceError(
      "Publish this AI Employee's DNA before listing it — the resume is built from published DNA.",
    );
  }

  const dnaSnapshot = sanitizeDnaForMarketplace(published.dna);
  const performanceSnapshot = await buildPerformanceSnapshot(
    store,
    actor.organizationId,
    input.employeeId,
  );
  const includeVaults = input.includeVaults ?? false;
  const vaultSnapshot = includeVaults
    ? await buildVaultSnapshot(store, actor.organizationId, input.employeeId, opts?.describeVault)
    : [];

  const title = (input.title?.trim() || employee.name).slice(0, 200);
  const roleTitle = employee.roleTitle || dnaSnapshot.identity.roleSummary || null;
  const nowIso = new Date().toISOString();

  const existing = await store.getMarketplaceListingForEmployee(
    actor.organizationId,
    input.employeeId,
  );

  let listing: MarketplaceListing | null;
  if (existing) {
    listing = await store.updateMarketplaceListing(existing.id, {
      title,
      headline: input.headline ?? null,
      summary: input.summary ?? null,
      roleTitle,
      status: "published",
      includeVaults,
      dnaVersionNumber: published.versionNumber,
      dnaSnapshot,
      performanceSnapshot,
      vaultSnapshot,
      publishedAt: existing.publishedAt ?? nowIso,
    });
  } else {
    listing = await store.createMarketplaceListing({
      organizationId: actor.organizationId,
      employeeId: input.employeeId,
      publicKey: newPublicKey(),
      title,
      headline: input.headline ?? null,
      summary: input.summary ?? null,
      roleTitle,
      status: "published",
      includeVaults,
      dnaVersionNumber: published.versionNumber,
      dnaSnapshot,
      performanceSnapshot,
      vaultSnapshot,
      createdByUserId: actor.userId,
      publishedAt: nowIso,
    });
  }
  if (!listing) throw new MarketplaceError("Could not publish this listing.");

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "marketplace_listing.published",
    targetType: "marketplace_listing",
    targetId: listing.id,
    metadata: { listingId: listing.id, employeeId: input.employeeId, includeVaults },
  });

  return listing;
}

/** Remove a listing from the public directory (the owner keeps the employee). */
export async function unpublishListing(
  store: DataStore,
  actor: MarketplaceActor,
  listingId: string,
): Promise<void> {
  const listing = await store.getMarketplaceListing(listingId);
  if (!listing || listing.organizationId !== actor.organizationId) {
    throw new MarketplaceError("This listing could not be found.");
  }
  await store.updateMarketplaceListing(listingId, { status: "unpublished" });
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "marketplace_listing.unpublished",
    targetType: "marketplace_listing",
    targetId: listingId,
    metadata: { listingId },
  });
}

export function listMarketplace(store: DataStore): Promise<MarketplaceListing[]> {
  return store.listPublishedMarketplaceListings();
}

/** A published listing readable cross-org (only if currently published). */
export async function getPublishedListing(
  store: DataStore,
  listingId: string,
): Promise<MarketplaceListing | null> {
  const listing = await store.getMarketplaceListing(listingId);
  if (!listing || listing.status !== "published") return null;
  return listing;
}

/** Request to hire a listed agent. The owner approves to clone it into your org. */
export async function requestHire(
  store: DataStore,
  actor: MarketplaceActor,
  input: { listingId: string; note?: string },
): Promise<MarketplaceHire> {
  const listing = await store.getMarketplaceListing(input.listingId);
  if (!listing || listing.status !== "published") {
    throw new MarketplaceError("This listing is no longer available.");
  }
  if (listing.organizationId === actor.organizationId) {
    throw new MarketplaceError("This agent already belongs to your organization.");
  }
  const hire = await store.createMarketplaceHire({
    listingId: listing.id,
    listingOrganizationId: listing.organizationId,
    hirerOrganizationId: actor.organizationId,
    note: input.note ?? null,
    requestedByUserId: actor.userId,
  });
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "marketplace_hire.requested",
    targetType: "marketplace_hire",
    targetId: hire.id,
    metadata: { hireId: hire.id, listingId: listing.id },
  });
  return hire;
}

/**
 * Approve a hire request: clone the listing's DNA snapshot into the hirer's org
 * as a new (draft) employee with published DNA. No knowledge vault is copied.
 * The actor must own the listing.
 */
export async function approveHire(
  store: DataStore,
  actor: MarketplaceActor,
  hireId: string,
): Promise<MarketplaceHire> {
  const hire = await store.getMarketplaceHire(hireId);
  if (!hire || hire.listingOrganizationId !== actor.organizationId) {
    throw new MarketplaceError("This hire request could not be found.");
  }
  if (hire.status !== "requested") {
    throw new MarketplaceError("This request has already been decided.");
  }
  const listing = await store.getMarketplaceListing(hire.listingId);
  if (!listing) throw new MarketplaceError("The listing no longer exists.");

  const dna = listing.dnaSnapshot;
  const cloneOwnerUserId = hire.requestedByUserId ?? null;

  // Create the clone in the HIRER's organization (not the seller's).
  const employee = await store.createEmployee({
    organizationId: hire.hirerOrganizationId,
    name: listing.title,
    roleTitle: listing.roleTitle || dna.identity.roleSummary || "AI Employee",
    status: "draft",
    visibility: "private",
    createdBy: cloneOwnerUserId,
  });
  // Clone the DNA (draft → publish) so the hired agent is ready to configure.
  await store.saveEmployeeDnaDraft({
    organizationId: hire.hirerOrganizationId,
    employeeId: employee.id,
    dna,
    userId: cloneOwnerUserId ?? actor.userId,
  });
  await store.publishEmployeeDna({
    organizationId: hire.hirerOrganizationId,
    employeeId: employee.id,
    userId: cloneOwnerUserId ?? actor.userId,
  });

  const updated = await store.updateMarketplaceHire(hireId, {
    status: "approved",
    hirerEmployeeId: employee.id,
    decidedByUserId: actor.userId,
    decidedAt: new Date().toISOString(),
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "marketplace_hire.approved",
    targetType: "marketplace_hire",
    targetId: hireId,
    metadata: { hireId, listingId: listing.id, hirerEmployeeId: employee.id },
  });

  return updated ?? hire;
}

export async function declineHire(
  store: DataStore,
  actor: MarketplaceActor,
  hireId: string,
): Promise<MarketplaceHire> {
  const hire = await store.getMarketplaceHire(hireId);
  if (!hire || hire.listingOrganizationId !== actor.organizationId) {
    throw new MarketplaceError("This hire request could not be found.");
  }
  if (hire.status !== "requested") {
    throw new MarketplaceError("This request has already been decided.");
  }
  const updated = await store.updateMarketplaceHire(hireId, {
    status: "declined",
    decidedByUserId: actor.userId,
    decidedAt: new Date().toISOString(),
  });
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "marketplace_hire.declined",
    targetType: "marketplace_hire",
    targetId: hireId,
    metadata: { hireId },
  });
  return updated ?? hire;
}

export function listOwnListings(
  store: DataStore,
  organizationId: string,
): Promise<MarketplaceListing[]> {
  return store.listMarketplaceListingsForOrg(organizationId);
}

export function listIncomingHires(
  store: DataStore,
  organizationId: string,
): Promise<MarketplaceHire[]> {
  return store.listMarketplaceHiresForListingOrg(organizationId);
}

export function listOutgoingHires(
  store: DataStore,
  organizationId: string,
): Promise<MarketplaceHire[]> {
  return store.listMarketplaceHiresForHirerOrg(organizationId);
}
