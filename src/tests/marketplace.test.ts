import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import {
  publishListing,
  unpublishListing,
  requestHire,
  approveHire,
  declineHire,
  listMarketplace,
  getPublishedListing,
  sanitizeDnaForMarketplace,
  submitReview,
  canReviewListing,
  listListingReviews,
  MarketplaceError,
} from "@/modules/marketplace/service";

function dna(): EmployeeDnaV1 {
  const base = createEmptyDnaV1();
  return {
    ...base,
    identity: {
      mission: "Help customers succeed.",
      roleSummary: "Senior Support Specialist",
      primaryGoals: ["Resolve tickets fast"],
      successCriteria: ["CSAT > 90%"],
    },
    companyContext: {
      companyDescription: "SELLER_SECRET_COMPANY_INFO",
      productsAndServices: "SELLER_SECRET_PRODUCTS",
      targetCustomers: "SELLER_SECRET_CUSTOMERS",
      brandValues: ["secret-value"],
    },
  };
}

async function setup() {
  const store = new InMemoryStore();
  const sellerUser = await store.createUser({ email: "s@x.com", fullName: "Seller" });
  const buyerUser = await store.createUser({ email: "b@x.com", fullName: "Buyer" });
  const sellerOrg = (await createOrganizationForUser(store, sellerUser.id, { name: "Seller Co" }))
    .organization;
  const buyerOrg = (await createOrganizationForUser(store, buyerUser.id, { name: "Buyer Co" }))
    .organization;

  const employee = await store.createEmployee({
    organizationId: sellerOrg.id,
    name: "Nova",
    roleTitle: "Support",
  });
  await store.saveEmployeeDnaDraft({
    organizationId: sellerOrg.id,
    employeeId: employee.id,
    dna: dna(),
    userId: sellerUser.id,
  });
  await store.publishEmployeeDna({
    organizationId: sellerOrg.id,
    employeeId: employee.id,
    userId: sellerUser.id,
  });

  return { store, sellerUser, buyerUser, sellerOrg, buyerOrg, employee };
}

const actor = (organizationId: string, userId: string) => ({ organizationId, userId });

describe("marketplace — publish + discover", () => {
  it("publishes a listing and exposes it cross-org, with companyContext blanked", async () => {
    const { store, sellerUser, sellerOrg, buyerOrg, employee } = await setup();
    const listing = await publishListing(store, actor(sellerOrg.id, sellerUser.id), {
      employeeId: employee.id,
      title: "Support pro",
    });
    expect(listing.status).toBe("published");

    // The seller's private company narrative must NOT be in the public snapshot.
    const json = JSON.stringify(listing.dnaSnapshot);
    expect(json).not.toContain("SELLER_SECRET");
    expect(listing.dnaSnapshot.identity.mission).toContain("Help customers");

    // Visible from another org's marketplace.
    const all = await listMarketplace(store);
    expect(all.map((l) => l.id)).toContain(listing.id);
    void buyerOrg;
  });

  it("refuses to publish an employee without published DNA", async () => {
    const { store, sellerUser, sellerOrg } = await setup();
    const bare = await store.createEmployee({
      organizationId: sellerOrg.id,
      name: "Bare",
      roleTitle: "None",
    });
    await expect(
      publishListing(store, actor(sellerOrg.id, sellerUser.id), { employeeId: bare.id }),
    ).rejects.toBeInstanceOf(MarketplaceError);
  });

  it("fills missing vault descriptions from the injected AI writer, keeps existing ones", async () => {
    const { store, sellerUser, sellerOrg, employee } = await setup();
    // One vault with a description, one without.
    const described = await store.createKnowledgeVault({
      organizationId: sellerOrg.id,
      name: "Refund policy",
      description: "Existing description",
    });
    const bare = await store.createKnowledgeVault({ organizationId: sellerOrg.id, name: "Playbooks" });
    for (const v of [described, bare]) {
      await store.assignVaultToEmployee({
        organizationId: sellerOrg.id,
        employeeId: employee.id,
        vaultId: v.id,
      });
    }

    const listing = await publishListing(
      store,
      actor(sellerOrg.id, sellerUser.id),
      { employeeId: employee.id, includeVaults: true },
      { describeVault: async (name) => `AI description of ${name}` },
    );

    const byName = Object.fromEntries(listing.vaultSnapshot.map((v) => [v.name, v.description]));
    expect(byName["Refund policy"]).toBe("Existing description"); // kept
    expect(byName["Playbooks"]).toBe("AI description of Playbooks"); // AI-filled
  });

  it("sanitize blanks companyContext but keeps everything else", () => {
    const s = sanitizeDnaForMarketplace(dna());
    expect(s.companyContext.companyDescription).toBe("");
    expect(s.companyContext.brandValues).toEqual([]);
    expect(s.identity.roleSummary).toBe("Senior Support Specialist");
  });
});

describe("marketplace — hire clones DNA, never the vault", () => {
  it("approving a hire clones the DNA into the buyer org with published DNA", async () => {
    const { store, sellerUser, buyerUser, sellerOrg, buyerOrg, employee } = await setup();

    // Seller's agent uses a vault — publishing with vaults includes only its NAME.
    const vault = await store.createKnowledgeVault({ organizationId: sellerOrg.id, name: "Playbooks" });
    const src = await store.createKnowledgeSource({
      organizationId: sellerOrg.id,
      vaultId: vault.id,
      name: "Secret playbook",
      sourceType: "text",
      status: "ready",
    });
    await store.assignVaultToEmployee({
      organizationId: sellerOrg.id,
      employeeId: employee.id,
      vaultId: vault.id,
    });

    const listing = await publishListing(store, actor(sellerOrg.id, sellerUser.id), {
      employeeId: employee.id,
      includeVaults: true,
    });
    expect(listing.vaultSnapshot.map((v) => v.name)).toContain("Playbooks");

    // Buyer requests, seller approves → clone appears in the BUYER org.
    const hire = await requestHire(store, actor(buyerOrg.id, buyerUser.id), { listingId: listing.id });
    const approved = await approveHire(store, actor(sellerOrg.id, sellerUser.id), hire.id);
    expect(approved.status).toBe("approved");
    expect(approved.hirerEmployeeId).toBeTruthy();

    const clonedId = approved.hirerEmployeeId as string;
    const cloned = await store.getEmployee(buyerOrg.id, clonedId);
    expect(cloned).not.toBeNull();
    const clonedDna = await store.getPublishedEmployeeDna(buyerOrg.id, clonedId);
    expect(clonedDna?.dna.identity.roleSummary).toBe("Senior Support Specialist");

    // SECURITY: the seller's knowledge vault + source are NOT shared with the buyer.
    expect(await store.listVaultsForEmployee(buyerOrg.id, clonedId)).toHaveLength(0);
    expect(await store.listKnowledgeSourcesForEmployee(buyerOrg.id, clonedId)).toHaveLength(0);
    expect(await store.getKnowledgeSource(buyerOrg.id, src.id)).toBeNull();
  });

  it("cannot hire your own listing; and a declined request creates no clone", async () => {
    const { store, sellerUser, buyerUser, sellerOrg, buyerOrg, employee } = await setup();
    const listing = await publishListing(store, actor(sellerOrg.id, sellerUser.id), {
      employeeId: employee.id,
    });
    await expect(
      requestHire(store, actor(sellerOrg.id, sellerUser.id), { listingId: listing.id }),
    ).rejects.toBeInstanceOf(MarketplaceError);

    const hire = await requestHire(store, actor(buyerOrg.id, buyerUser.id), { listingId: listing.id });
    const declined = await declineHire(store, actor(sellerOrg.id, sellerUser.id), hire.id);
    expect(declined.status).toBe("declined");
    expect(declined.hirerEmployeeId).toBeNull();
  });

  it("only the listing owner can approve/decline", async () => {
    const { store, sellerUser, buyerUser, sellerOrg, buyerOrg, employee } = await setup();
    const listing = await publishListing(store, actor(sellerOrg.id, sellerUser.id), {
      employeeId: employee.id,
    });
    const hire = await requestHire(store, actor(buyerOrg.id, buyerUser.id), { listingId: listing.id });
    // Buyer (not the owner) must not be able to approve.
    await expect(
      approveHire(store, actor(buyerOrg.id, buyerUser.id), hire.id),
    ).rejects.toBeInstanceOf(MarketplaceError);
  });

  it("only a hirer can review; the review updates the listing's rating aggregate", async () => {
    const { store, sellerUser, buyerUser, sellerOrg, buyerOrg, employee } = await setup();
    const listing = await publishListing(store, actor(sellerOrg.id, sellerUser.id), {
      employeeId: employee.id,
    });

    // Before hiring, the buyer cannot review.
    expect(await canReviewListing(store, buyerOrg.id, listing)).toBe(false);
    await expect(
      submitReview(store, actor(buyerOrg.id, buyerUser.id), { listingId: listing.id, rating: 5 }),
    ).rejects.toBeInstanceOf(MarketplaceError);

    // Hire + approve, then the buyer can review.
    const hire = await requestHire(store, actor(buyerOrg.id, buyerUser.id), { listingId: listing.id });
    await approveHire(store, actor(sellerOrg.id, sellerUser.id), hire.id);
    expect(await canReviewListing(store, buyerOrg.id, listing)).toBe(true);

    await submitReview(store, actor(buyerOrg.id, buyerUser.id), {
      listingId: listing.id,
      rating: 4,
      comment: "Solid performer.",
    });
    let refreshed = await getPublishedListing(store, listing.id);
    expect(refreshed?.ratingCount).toBe(1);
    expect(refreshed?.ratingAvg).toBe(4);
    expect((await listListingReviews(store, listing.id))[0].comment).toBe("Solid performer.");

    // Updating the review (upsert) recomputes the average, not a second row.
    await submitReview(store, actor(buyerOrg.id, buyerUser.id), { listingId: listing.id, rating: 2 });
    refreshed = await getPublishedListing(store, listing.id);
    expect(refreshed?.ratingCount).toBe(1);
    expect(refreshed?.ratingAvg).toBe(2);
  });

  it("rejects reviewing your own listing and out-of-range ratings", async () => {
    const { store, sellerUser, buyerUser, sellerOrg, buyerOrg, employee } = await setup();
    const listing = await publishListing(store, actor(sellerOrg.id, sellerUser.id), {
      employeeId: employee.id,
    });
    await expect(
      submitReview(store, actor(sellerOrg.id, sellerUser.id), { listingId: listing.id, rating: 5 }),
    ).rejects.toBeInstanceOf(MarketplaceError);

    const hire = await requestHire(store, actor(buyerOrg.id, buyerUser.id), { listingId: listing.id });
    await approveHire(store, actor(sellerOrg.id, sellerUser.id), hire.id);
    await expect(
      submitReview(store, actor(buyerOrg.id, buyerUser.id), { listingId: listing.id, rating: 9 }),
    ).rejects.toBeInstanceOf(MarketplaceError);
  });

  it("unpublish removes it from the public directory", async () => {
    const { store, sellerUser, sellerOrg, employee } = await setup();
    const listing = await publishListing(store, actor(sellerOrg.id, sellerUser.id), {
      employeeId: employee.id,
    });
    await unpublishListing(store, actor(sellerOrg.id, sellerUser.id), listing.id);
    expect(await getPublishedListing(store, listing.id)).toBeNull();
    expect(await listMarketplace(store)).toHaveLength(0);
  });
});
