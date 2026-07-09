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
  MarketplaceReview,
  MarketplacePayment,
  MarketplacePaymentProviderId,
  MarketplacePricingModel,
  MarketplacePayout,
  MarketplacePayoutAccount,
  PerformanceSnapshot,
  VaultSnapshotItem,
} from "@/lib/db/types";
import type { EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import type {
  CheckoutResult,
  PaymentWebhookEvent,
  ConnectedAccountResult,
  OnboardingLinkResult,
  TransferResult,
  PayoutWebhookEvent,
} from "@/modules/marketplace/payments/types";
import { isSupportedCurrency, isPricedListing } from "@/modules/marketplace/pricing";

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

/**
 * Resolve a listing from its opaque public key for the UNAUTHENTICATED shareable
 * resume page. Only currently-published listings resolve; the caller must render
 * only the snapshot (no live tenant data ever crosses this boundary).
 */
export async function getPublicResumeByKey(
  store: DataStore,
  publicKey: string,
): Promise<MarketplaceListing | null> {
  const listing = await store.getMarketplaceListingByPublicKey(publicKey);
  if (!listing || listing.status !== "published") return null;
  return listing;
}

/**
 * Clone a listing's DNA snapshot into a target org as a new (published-DNA)
 * employee. NO knowledge vault is copied — only the DNA. Shared by free-listing
 * approval and paid-purchase fulfillment.
 */
async function cloneListingIntoOrg(
  store: DataStore,
  listing: MarketplaceListing,
  targetOrganizationId: string,
  ownerUserId: string,
) {
  const dna = listing.dnaSnapshot;
  const employee = await store.createEmployee({
    organizationId: targetOrganizationId,
    name: listing.title,
    roleTitle: listing.roleTitle || dna.identity.roleSummary || "AI Employee",
    status: "draft",
    visibility: "private",
    createdBy: ownerUserId,
  });
  await store.saveEmployeeDnaDraft({
    organizationId: targetOrganizationId,
    employeeId: employee.id,
    dna,
    userId: ownerUserId,
  });
  await store.publishEmployeeDna({
    organizationId: targetOrganizationId,
    employeeId: employee.id,
    userId: ownerUserId,
  });
  return employee;
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

  const employee = await cloneListingIntoOrg(
    store,
    listing,
    hire.hirerOrganizationId,
    hire.requestedByUserId ?? actor.userId,
  );

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

/* -------------------------------------------------------------------------- */
/* Ratings & reviews (Sprint 032)                                             */
/* -------------------------------------------------------------------------- */

/** Can this org leave a review? Only after it has hired the agent (and not its own). */
export async function canReviewListing(
  store: DataStore,
  organizationId: string,
  listing: MarketplaceListing,
): Promise<boolean> {
  if (listing.organizationId === organizationId) return false;
  return store.hasApprovedMarketplaceHire(listing.id, organizationId);
}

export function listListingReviews(
  store: DataStore,
  listingId: string,
): Promise<MarketplaceReview[]> {
  return store.listMarketplaceReviews(listingId);
}

export function getMyReview(
  store: DataStore,
  listingId: string,
  organizationId: string,
): Promise<MarketplaceReview | null> {
  return store.getMarketplaceReviewForReviewer(listingId, organizationId);
}

/** Leave (or update) a rating + review for an agent you've hired. */
export async function submitReview(
  store: DataStore,
  actor: MarketplaceActor,
  input: { listingId: string; rating: number; comment?: string },
): Promise<MarketplaceReview> {
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new MarketplaceError("Choose a rating from 1 to 5 stars.");
  }
  const listing = await store.getMarketplaceListing(input.listingId);
  if (!listing) throw new MarketplaceError("This listing could not be found.");
  if (listing.organizationId === actor.organizationId) {
    throw new MarketplaceError("You can't review your own listing.");
  }
  const hired = await store.hasApprovedMarketplaceHire(listing.id, actor.organizationId);
  if (!hired) {
    throw new MarketplaceError("You can review an AI Employee once you've hired it.");
  }

  const comment = input.comment?.trim() ? input.comment.trim().slice(0, 2000) : null;
  const review = await store.upsertMarketplaceReview({
    listingId: listing.id,
    reviewerOrganizationId: actor.organizationId,
    reviewerUserId: actor.userId,
    rating,
    comment,
  });

  // Recompute the denormalized aggregate from the full review set.
  const all = await store.listMarketplaceReviews(listing.id);
  const count = all.length;
  const avg = count > 0 ? all.reduce((sum, r) => sum + r.rating, 0) / count : null;
  await store.updateMarketplaceListing(listing.id, { ratingCount: count, ratingAvg: avg });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "marketplace_review.submitted",
    targetType: "marketplace_listing",
    targetId: listing.id,
    metadata: { listingId: listing.id, rating },
  });

  return review;
}

/* -------------------------------------------------------------------------- */
/* Paid lease / revenue-share (Sprint 034)                                    */
/* -------------------------------------------------------------------------- */

function newPaymentReference(): string {
  return `mp_${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
}

/** Split a gross amount (minor units) into platform fee + seller net. */
function splitRevenue(amount: number, feeBps: number): { platformFee: number; sellerNet: number } {
  const safe = Math.max(0, Math.round(amount));
  const bps = Math.min(10_000, Math.max(0, Math.round(feeBps)));
  const platformFee = Math.floor((safe * bps) / 10_000);
  return { platformFee, sellerNet: safe - platformFee };
}

export interface SetListingPriceInput {
  listingId: string;
  priceModel: MarketplacePricingModel;
  /** Major-unit-derived minor amount (e.g. cents). Required when one_time. */
  priceAmount?: number | null;
  priceCurrency?: string | null;
}

/** Set (or clear) the one-time hire price on a listing. Owner only. */
export async function setListingPrice(
  store: DataStore,
  actor: MarketplaceActor,
  input: SetListingPriceInput,
): Promise<MarketplaceListing> {
  const listing = await store.getMarketplaceListing(input.listingId);
  if (!listing || listing.organizationId !== actor.organizationId) {
    throw new MarketplaceError("This listing could not be found.");
  }
  if (input.priceModel === "free") {
    const updated = await store.updateMarketplaceListing(listing.id, {
      priceModel: "free",
      priceAmount: null,
      priceCurrency: null,
    });
    return updated ?? listing;
  }
  const amount = input.priceAmount ?? 0;
  const currency = (input.priceCurrency ?? "").toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new MarketplaceError("Enter a price greater than zero.");
  }
  if (!isSupportedCurrency(currency)) {
    throw new MarketplaceError("Choose a supported currency.");
  }
  const updated = await store.updateMarketplaceListing(listing.id, {
    priceModel: "one_time",
    priceAmount: Math.round(amount),
    priceCurrency: currency,
  });
  return updated ?? listing;
}

export interface StartHirePurchaseOptions {
  provider: MarketplacePaymentProviderId;
  /** Platform revenue-share cut in basis points (0–10000). */
  feeBps: number;
  successUrl: string;
  cancelUrl: string;
  /** Injected by the action layer (gateway to the real/simulated provider). */
  createCheckout: (input: {
    reference: string;
    amount: number;
    currency: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  }) => Promise<CheckoutResult>;
}

export type StartHirePurchaseResult =
  | { status: "redirect"; url: string; payment: MarketplacePayment }
  | { status: "completed"; hire: MarketplaceHire; payment: MarketplacePayment };

/**
 * Begin buying a priced listing. Records a pending payment + starts a hosted
 * checkout. In simulated mode the purchase completes in-process (no charge) and
 * the DNA is cloned immediately; otherwise the buyer is redirected to pay and
 * fulfillment happens on the verified webhook.
 */
export async function startHirePurchase(
  store: DataStore,
  actor: MarketplaceActor,
  input: { listingId: string },
  opts: StartHirePurchaseOptions,
): Promise<StartHirePurchaseResult> {
  const listing = await store.getMarketplaceListing(input.listingId);
  if (!listing || listing.status !== "published") {
    throw new MarketplaceError("This listing is no longer available.");
  }
  if (listing.organizationId === actor.organizationId) {
    throw new MarketplaceError("This AI Employee already belongs to your organization.");
  }
  if (!isPricedListing(listing)) {
    throw new MarketplaceError("This listing is free — request to hire it instead.");
  }

  const amount = listing.priceAmount as number;
  const currency = listing.priceCurrency as string;
  const { platformFee, sellerNet } = splitRevenue(amount, opts.feeBps);
  const reference = newPaymentReference();

  const payment = await store.createMarketplacePayment({
    listingId: listing.id,
    buyerOrganizationId: actor.organizationId,
    sellerOrganizationId: listing.organizationId,
    provider: opts.provider,
    reference,
    amount,
    currency,
    platformFee,
    sellerNet,
    status: "pending",
    createdByUserId: actor.userId,
  });

  const checkout = await opts.createCheckout({
    reference,
    amount,
    currency,
    description: `Hire: ${listing.title}`,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
  });

  if (checkout.mode === "redirect") {
    const patched = await store.updateMarketplacePayment(payment.id, {
      externalPaymentId: checkout.externalPaymentId ?? null,
    });
    return { status: "redirect", url: checkout.url, payment: patched ?? payment };
  }

  // Simulated: settle immediately.
  const settled = await settlePaidPayment(store, payment);
  const hire = settled.hireId ? await store.getMarketplaceHire(settled.hireId) : null;
  if (!hire) throw new MarketplaceError("Could not complete the purchase.");
  return { status: "completed", hire, payment: settled };
}

/**
 * Idempotently mark a payment paid: clone the DNA into the buyer's org and link
 * the resulting hire. Safe to call more than once (a second call is a no-op).
 */
async function settlePaidPayment(
  store: DataStore,
  payment: MarketplacePayment,
): Promise<MarketplacePayment> {
  const fresh = (await store.getMarketplacePayment(payment.id)) ?? payment;
  if (fresh.status === "paid" && fresh.hireId) return fresh;

  const listing = await store.getMarketplaceListing(fresh.listingId);
  if (!listing) throw new MarketplaceError("The listing no longer exists.");

  const ownerUserId = fresh.createdByUserId;
  if (!ownerUserId) {
    throw new MarketplaceError("This purchase is missing its buyer — cannot fulfill.");
  }

  // Create the hire (record) and clone the DNA into the buyer org.
  const hire = await store.createMarketplaceHire({
    listingId: listing.id,
    listingOrganizationId: listing.organizationId,
    hirerOrganizationId: fresh.buyerOrganizationId,
    note: "Purchased",
    requestedByUserId: ownerUserId,
  });
  const employee = await cloneListingIntoOrg(store, listing, fresh.buyerOrganizationId, ownerUserId);
  await store.updateMarketplaceHire(hire.id, {
    status: "approved",
    hirerEmployeeId: employee.id,
    decidedByUserId: ownerUserId,
    decidedAt: new Date().toISOString(),
  });

  const paid = await store.updateMarketplacePayment(fresh.id, {
    status: "paid",
    paidAt: new Date().toISOString(),
    hireId: hire.id,
  });

  await store.createAuditEvent({
    organizationId: fresh.buyerOrganizationId,
    actorType: "user",
    actorId: ownerUserId,
    action: "marketplace_payment.paid",
    targetType: "marketplace_payment",
    targetId: fresh.id,
    metadata: {
      paymentId: fresh.id,
      listingId: listing.id,
      hireId: hire.id,
      amount: fresh.amount,
      currency: fresh.currency,
      platformFee: fresh.platformFee,
      sellerNet: fresh.sellerNet,
      provider: fresh.provider,
    },
  });

  return paid ?? fresh;
}

export interface FulfillResult {
  handled: boolean;
  status: MarketplacePayment["status"] | "ignored" | "unknown";
}

/**
 * Apply a normalized payment webhook event. Resolves the payment from the event
 * (never trusting the body for identity beyond our own reference / provider id),
 * then settles or fails it. Idempotent.
 */
export async function fulfillMarketplacePayment(
  store: DataStore,
  provider: MarketplacePaymentProviderId,
  event: PaymentWebhookEvent,
): Promise<FulfillResult> {
  if (event.type === "ignored") return { handled: false, status: "ignored" };

  let payment: MarketplacePayment | null = null;
  if (event.reference) payment = await store.getMarketplacePaymentByReference(event.reference);
  if (!payment && event.externalPaymentId) {
    payment = await store.getMarketplacePaymentByExternalId(provider, event.externalPaymentId);
  }
  if (!payment || payment.provider !== provider) {
    return { handled: false, status: "unknown" };
  }

  // Record the provider's id if we resolved by our own reference.
  if (event.externalPaymentId && !payment.externalPaymentId) {
    payment =
      (await store.updateMarketplacePayment(payment.id, {
        externalPaymentId: event.externalPaymentId,
      })) ?? payment;
  }

  if (event.type === "failed") {
    if (payment.status === "pending") {
      await store.updateMarketplacePayment(payment.id, { status: "failed" });
    }
    return { handled: true, status: "failed" };
  }

  const settled = await settlePaidPayment(store, payment);
  return { handled: true, status: settled.status };
}

export function listBuyerPayments(
  store: DataStore,
  organizationId: string,
): Promise<MarketplacePayment[]> {
  return store.listMarketplacePaymentsForBuyer(organizationId);
}

export function listSellerPayments(
  store: DataStore,
  organizationId: string,
): Promise<MarketplacePayment[]> {
  return store.listMarketplacePaymentsForSeller(organizationId);
}

/* -------------------------------------------------------------------------- */
/* Seller payouts (Sprint 035)                                                */
/* -------------------------------------------------------------------------- */

function newPayoutReference(): string {
  return `po_${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
}

export function getPayoutAccount(
  store: DataStore,
  organizationId: string,
): Promise<MarketplacePayoutAccount | null> {
  return store.getMarketplacePayoutAccount(organizationId);
}

export function listPayouts(
  store: DataStore,
  organizationId: string,
): Promise<MarketplacePayout[]> {
  return store.listMarketplacePayoutsForOrg(organizationId);
}

export interface CurrencyBalance {
  currency: string;
  earned: number; // Σ seller_net of paid payments
  paidOut: number; // Σ amount of settled payouts
  pending: number; // Σ amount of in-flight payouts
  available: number; // earned − paidOut − pending
}

/**
 * Per-currency payout balance derived from the ledgers (never stored):
 * available = Σ paid seller_net − Σ (paid + pending) payouts.
 */
export async function getSellerBalances(
  store: DataStore,
  organizationId: string,
): Promise<CurrencyBalance[]> {
  const [payments, payouts] = await Promise.all([
    store.listMarketplacePaymentsForSeller(organizationId),
    store.listMarketplacePayoutsForOrg(organizationId),
  ]);
  const map = new Map<string, CurrencyBalance>();
  const row = (currency: string): CurrencyBalance => {
    let r = map.get(currency);
    if (!r) {
      r = { currency, earned: 0, paidOut: 0, pending: 0, available: 0 };
      map.set(currency, r);
    }
    return r;
  };
  for (const p of payments) {
    if (p.status === "paid") row(p.currency).earned += p.sellerNet;
  }
  for (const p of payouts) {
    if (p.status === "paid") row(p.currency).paidOut += p.amount;
    else if (p.status === "pending") row(p.currency).pending += p.amount;
  }
  for (const r of map.values()) r.available = r.earned - r.paidOut - r.pending;
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export interface StartPayoutOnboardingOptions {
  provider: MarketplacePaymentProviderId;
  returnUrl: string;
  refreshUrl: string;
  createConnectedAccount: (input: {
    organizationId: string;
  }) => Promise<ConnectedAccountResult>;
  createOnboardingLink: (input: {
    externalAccountId: string;
    returnUrl: string;
    refreshUrl: string;
  }) => Promise<OnboardingLinkResult>;
}

export type StartPayoutOnboardingResult =
  | { status: "redirect"; url: string; account: MarketplacePayoutAccount }
  | { status: "active"; account: MarketplacePayoutAccount };

/**
 * Connect (or resume connecting) a payout account. Creates the connected account
 * on first use, then returns a hosted onboarding link. In simulated mode the
 * account is immediately active (no hosted onboarding).
 */
export async function startPayoutOnboarding(
  store: DataStore,
  actor: MarketplaceActor,
  opts: StartPayoutOnboardingOptions,
): Promise<StartPayoutOnboardingResult> {
  let account = await store.getMarketplacePayoutAccount(actor.organizationId);

  // Create the connected account on first connect (or if provider changed).
  if (!account || !account.externalAccountId || account.provider !== opts.provider) {
    const created = await opts.createConnectedAccount({ organizationId: actor.organizationId });
    account = await store.upsertMarketplacePayoutAccount({
      organizationId: actor.organizationId,
      provider: opts.provider,
      externalAccountId: created.externalAccountId,
      status: created.status,
      createdByUserId: actor.userId,
    });
  }

  const link = await opts.createOnboardingLink({
    externalAccountId: account.externalAccountId as string,
    returnUrl: opts.returnUrl,
    refreshUrl: opts.refreshUrl,
  });

  if (link.mode === "redirect") {
    return { status: "redirect", url: link.url, account };
  }

  // Simulated: mark active immediately.
  const active =
    (await store.updateMarketplacePayoutAccount(actor.organizationId, { status: "active" })) ??
    account;
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "marketplace_payout_account.connected",
    targetType: "marketplace_payout_account",
    targetId: active.id,
    metadata: { provider: opts.provider, status: active.status },
  });
  return { status: "active", account: active };
}

export interface RequestPayoutOptions {
  createTransfer: (input: {
    externalAccountId: string;
    amount: number;
    currency: string;
    reference: string;
  }) => Promise<TransferResult>;
}

/**
 * Withdraw the full available balance in a currency to the connected account.
 * Records a payout row FIRST (so the balance can't be double-spent by a
 * concurrent request), then moves the money. Simulated + successful live
 * transfers settle immediately; failures are reconciled by webhook.
 */
export async function requestPayout(
  store: DataStore,
  actor: MarketplaceActor,
  input: { currency: string },
  opts: RequestPayoutOptions,
): Promise<MarketplacePayout> {
  const account = await store.getMarketplacePayoutAccount(actor.organizationId);
  if (!account || account.status !== "active" || !account.externalAccountId) {
    throw new MarketplaceError("Connect a payout account before withdrawing.");
  }
  const currency = input.currency.toLowerCase();
  const balances = await getSellerBalances(store, actor.organizationId);
  const balance = balances.find((b) => b.currency === currency);
  if (!balance || balance.available <= 0) {
    throw new MarketplaceError("You have no balance to withdraw in this currency.");
  }

  const reference = newPayoutReference();
  const payout = await store.createMarketplacePayout({
    organizationId: actor.organizationId,
    provider: account.provider,
    externalAccountId: account.externalAccountId,
    reference,
    amount: balance.available,
    currency,
    status: "pending",
    createdByUserId: actor.userId,
  });

  let transfer: TransferResult;
  try {
    transfer = await opts.createTransfer({
      externalAccountId: account.externalAccountId,
      amount: balance.available,
      currency,
      reference,
    });
  } catch (err) {
    await store.updateMarketplacePayout(payout.id, { status: "failed" });
    throw err instanceof Error ? new MarketplaceError(err.message) : err;
  }

  // Both simulated and a successfully created transfer move funds to the seller.
  const externalTransferId = transfer.mode === "transferred" ? transfer.externalTransferId : null;
  const settled = await store.updateMarketplacePayout(payout.id, {
    status: "paid",
    paidAt: new Date().toISOString(),
    externalTransferId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "marketplace_payout.sent",
    targetType: "marketplace_payout",
    targetId: payout.id,
    metadata: {
      payoutId: payout.id,
      amount: balance.available,
      currency,
      provider: account.provider,
    },
  });

  return settled ?? payout;
}

export interface FulfillPayoutResult {
  handled: boolean;
  kind: "account" | "payout" | "ignored" | "unknown";
}

/** Apply a normalized payout/account webhook event. Idempotent. */
export async function fulfillPayoutWebhook(
  store: DataStore,
  provider: MarketplacePaymentProviderId,
  event: PayoutWebhookEvent,
): Promise<FulfillPayoutResult> {
  if (event.type === "account.updated") {
    if (!event.externalAccountId) return { handled: false, kind: "unknown" };
    const account = await store.getMarketplacePayoutAccountByExternalId(event.externalAccountId);
    if (!account) return { handled: false, kind: "unknown" };
    if (event.accountStatus && event.accountStatus !== account.status) {
      await store.updateMarketplacePayoutAccount(account.organizationId, {
        status: event.accountStatus,
      });
    }
    return { handled: true, kind: "account" };
  }

  if (event.type === "payout.paid" || event.type === "payout.failed") {
    let payout: MarketplacePayout | null = null;
    if (event.reference) payout = await store.getMarketplacePayoutByReference(event.reference);
    if (!payout && event.externalTransferId) {
      payout = await store.getMarketplacePayoutByExternalTransferId(
        provider,
        event.externalTransferId,
      );
    }
    if (!payout || payout.provider !== provider) return { handled: false, kind: "unknown" };

    if (event.type === "payout.failed") {
      if (payout.status !== "failed") {
        await store.updateMarketplacePayout(payout.id, { status: "failed" });
      }
      return { handled: true, kind: "payout" };
    }
    // paid — idempotent: only settle a still-pending payout.
    if (payout.status !== "paid") {
      await store.updateMarketplacePayout(payout.id, {
        status: "paid",
        paidAt: new Date().toISOString(),
        externalTransferId: event.externalTransferId ?? payout.externalTransferId,
      });
    }
    return { handled: true, kind: "payout" };
  }

  return { handled: false, kind: "ignored" };
}
