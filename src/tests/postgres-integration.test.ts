import { describe, it, expect, beforeAll } from "vitest";
import { PostgresStore } from "@/lib/db/postgres-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { getOnboardingState, recordOnboardingCompletion } from "@/modules/onboarding/service";
import {
  publishListing,
  setListingPrice,
  startHirePurchase,
  fulfillMarketplacePayment,
  listSellerPayments,
} from "@/modules/marketplace/service";
import type { ChannelAppearance } from "@/lib/db/types";

function dnaFixture(): EmployeeDnaV1 {
  return {
    ...createEmptyDnaV1(),
    identity: {
      mission: "Help customers succeed.",
      roleSummary: "Senior Support Specialist",
      primaryGoals: ["Resolve tickets fast"],
      successCriteria: ["CSAT > 90%"],
    },
  };
}

/**
 * PostgreSQL integration parity (Sprint 020 follow-up).
 *
 * Proves the real PostgresStore works end-to-end against a freshly migrated
 * database — i.e. the migration chain produces exactly the schema the code
 * expects, so a fresh build does not break any feature. Exercises the core
 * entities plus the Sprint 020 onboarding + audit paths.
 *
 * Inert unless DATABASE_URL is set (so the normal test run, which uses the
 * in-memory store, is unaffected). Run it with:
 *   DATABASE_URL=postgres://… npx vitest run src/tests/postgres-integration.test.ts
 */

const DATABASE_URL = process.env.DATABASE_URL;

const APPEARANCE: ChannelAppearance = {
  theme: "dark",
  position: "bottom-right",
  launcherLabel: "Chat",
  employeeDisplayName: "Nova",
  accentStyle: "mono",
  showSources: true,
  collectVisitorEmail: false,
  brandName: null,
};

describe.skipIf(!DATABASE_URL)("PostgresStore parity on a fresh schema", () => {
  let store: PostgresStore;
  // Unique suffix so repeated runs against the same database never collide.
  const stamp = `${process.pid}-${Math.floor(performance.now())}`;

  beforeAll(() => {
    store = new PostgresStore();
  });

  it("runs the full hire → DNA → knowledge → chat → deploy → onboarding flow", async () => {
    const user = await store.createUser({
      email: `owner+${stamp}@example.com`,
      fullName: "Owner",
    });
    const { organization } = await createOrganizationForUser(store, user.id, {
      name: `Acme ${stamp}`,
    });
    const ctx = { organizationId: organization.id, userId: user.id, role: "owner" as const };

    // Brand-new org: nothing done, nothing dismissed.
    const empty = await getOnboardingState(store, ctx);
    expect(empty.complete).toBe(false);
    expect(empty.requiredDone).toBe(0);

    // Hire.
    const employee = await store.createEmployee({
      organizationId: organization.id,
      name: "Nova",
      roleTitle: "Support Specialist",
      department: "Support",
      description: null,
      status: "active",
      createdBy: null,
    });

    // DNA draft + publish.
    const dna: EmployeeDnaV1 = {
      ...createEmptyDnaV1(),
      identity: { mission: "Help", roleSummary: "Support", primaryGoals: [], successCriteria: [] },
    };
    await store.saveEmployeeDnaDraft({
      organizationId: organization.id,
      employeeId: employee.id,
      dna,
      userId: user.id,
    });
    await store.publishEmployeeDna({
      organizationId: organization.id,
      employeeId: employee.id,
      userId: user.id,
    });
    expect(await store.getPublishedEmployeeDna(organization.id, employee.id)).not.toBeNull();

    // Knowledge source.
    await store.createKnowledgeSource({
      organizationId: organization.id,
      name: "Pricing guide",
      description: null,
      sourceType: "text",
      visibility: "organization",
    });

    // Chat thread (a "test in chat").
    await store.createEmployeeChatThread({
      organizationId: organization.id,
      employeeId: employee.id,
      title: "Test drive",
      createdByUserId: user.id,
    });

    // Deploy a web widget channel.
    const channel = await store.createEmployeeChannel({
      organizationId: organization.id,
      employeeId: employee.id,
      channelType: "website_widget",
      publicKey: `tc_${stamp}`,
      name: "Website",
      appearance: APPEARANCE,
    });
    await store.activateEmployeeChannel(organization.id, channel.id);

    // Every required onboarding step is now satisfied from real Postgres data.
    const done = await getOnboardingState(store, ctx);
    expect(done.steps.every((s) => s.done)).toBe(true);
    expect(done.complete).toBe(true);

    // Onboarding progress persists (Sprint 020 table).
    await store.setOnboardingDismissed(organization.id, true, user.id);
    expect((await store.getOnboardingProgress(organization.id))?.dismissedAt).toBeTruthy();
    await store.setOnboardingDismissed(organization.id, false, user.id);
    expect((await store.getOnboardingProgress(organization.id))?.dismissedAt).toBeNull();

    // Completion milestone records once + writes an audit event.
    await recordOnboardingCompletion(store, ctx);
    await recordOnboardingCompletion(store, ctx);
    const audits = await store.listAuditEvents(organization.id, 100);
    expect(audits.filter((e) => e.action === "onboarding.completed")).toHaveLength(1);
    expect((await store.getOnboardingProgress(organization.id))?.completedAt).toBeTruthy();
  });

  it("runs the marketplace priced-purchase flow on real Postgres (Sprint 034)", async () => {
    const sellerUser = await store.createUser({ email: `seller+${stamp}@x.com`, fullName: "S" });
    const buyerUser = await store.createUser({ email: `buyer+${stamp}@x.com`, fullName: "B" });
    const sellerOrg = (
      await createOrganizationForUser(store, sellerUser.id, { name: `Sell ${stamp}` })
    ).organization;
    const buyerOrg = (await createOrganizationForUser(store, buyerUser.id, { name: `Buy ${stamp}` }))
      .organization;

    const employee = await store.createEmployee({
      organizationId: sellerOrg.id,
      name: "Nova",
      roleTitle: "Support",
    });
    await store.saveEmployeeDnaDraft({
      organizationId: sellerOrg.id,
      employeeId: employee.id,
      dna: dnaFixture(),
      userId: sellerUser.id,
    });
    await store.publishEmployeeDna({
      organizationId: sellerOrg.id,
      employeeId: employee.id,
      userId: sellerUser.id,
    });

    const listing = await publishListing(
      store,
      { organizationId: sellerOrg.id, userId: sellerUser.id },
      { employeeId: employee.id },
    );
    await setListingPrice(
      store,
      { organizationId: sellerOrg.id, userId: sellerUser.id },
      { listingId: listing.id, priceModel: "one_time", priceAmount: 10_000, priceCurrency: "usd" },
    );
    const priced = await store.getMarketplaceListing(listing.id);
    expect(priced?.priceAmount).toBe(10_000);
    expect(priced?.priceModel).toBe("one_time");

    // Redirect flow → pending payment persisted with the external id.
    const result = await startHirePurchase(
      store,
      { organizationId: buyerOrg.id, userId: buyerUser.id },
      { listingId: listing.id },
      {
        provider: "stripe",
        feeBps: 1500,
        successUrl: "https://app/s",
        cancelUrl: "https://app/c",
        createCheckout: async (input) => ({
          mode: "redirect",
          url: `https://checkout/${input.reference}`,
          externalPaymentId: `cs_${stamp}`,
        }),
      },
    );
    expect(result.status).toBe("redirect");
    if (result.status !== "redirect") throw new Error("unreachable");

    // Webhook settles it: DNA cloned, split recorded, idempotent on replay.
    const first = await fulfillMarketplacePayment(store, "stripe", {
      type: "paid",
      reference: result.payment.reference,
      externalPaymentId: `cs_${stamp}`,
    });
    expect(first).toEqual({ handled: true, status: "paid" });
    await fulfillMarketplacePayment(store, "stripe", {
      type: "paid",
      reference: result.payment.reference,
      externalPaymentId: `cs_${stamp}`,
    });

    const earnings = await listSellerPayments(store, sellerOrg.id);
    expect(earnings).toHaveLength(1);
    expect(earnings[0].platformFee).toBe(1500);
    expect(earnings[0].sellerNet).toBe(8500);
    expect(earnings[0].status).toBe("paid");

    // Exactly one hire/clone despite the replayed webhook.
    const hires = await store.listMarketplaceHiresForHirerOrg(buyerOrg.id);
    expect(hires).toHaveLength(1);
    const clonedId = hires[0].hirerEmployeeId as string;
    expect(await store.listVaultsForEmployee(buyerOrg.id, clonedId)).toHaveLength(0);
    const clonedDna = await store.getPublishedEmployeeDna(buyerOrg.id, clonedId);
    expect(clonedDna?.dna.identity.roleSummary).toBe("Senior Support Specialist");
  });
});
