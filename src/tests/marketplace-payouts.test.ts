import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import {
  publishListing,
  setListingPrice,
  startHirePurchase,
  getSellerBalances,
  startPayoutOnboarding,
  requestPayout,
  fulfillPayoutWebhook,
  listPayouts,
  getPayoutAccount,
  MarketplaceError,
} from "@/modules/marketplace/service";
import { getMarketplacePayoutProvider } from "@/modules/marketplace/payments";

function dna(): EmployeeDnaV1 {
  return {
    ...createEmptyDnaV1(),
    identity: {
      mission: "Help.",
      roleSummary: "Support Specialist",
      primaryGoals: ["x"],
      successCriteria: ["y"],
    },
  };
}

const actor = (organizationId: string, userId: string) => ({ organizationId, userId });

/** A seller org that has earned one paid $100 sale (net 8500 after the 15% fee). */
async function sellerWithBalance() {
  const store = new InMemoryStore();
  const sellerUser = await store.createUser({ email: "s@x.com", fullName: "S" });
  const buyerUser = await store.createUser({ email: "b@x.com", fullName: "B" });
  const sellerOrg = (await createOrganizationForUser(store, sellerUser.id, { name: "Sell" }))
    .organization;
  const buyerOrg = (await createOrganizationForUser(store, buyerUser.id, { name: "Buy" }))
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
  const listing = await publishListing(store, actor(sellerOrg.id, sellerUser.id), {
    employeeId: employee.id,
  });
  await setListingPrice(store, actor(sellerOrg.id, sellerUser.id), {
    listingId: listing.id,
    priceModel: "one_time",
    priceAmount: 10_000,
    priceCurrency: "usd",
  });
  await startHirePurchase(
    store,
    actor(buyerOrg.id, buyerUser.id),
    { listingId: listing.id },
    {
      provider: "simulated",
      feeBps: 1500,
      successUrl: "s",
      cancelUrl: "c",
      createCheckout: async () => ({ mode: "simulated" }),
    },
  );
  return { store, sellerUser, sellerOrg, buyerOrg, buyerUser };
}

const simProvider = getMarketplacePayoutProvider("simulated");
const onboardingOpts = {
  provider: "simulated" as const,
  returnUrl: "https://app/return",
  refreshUrl: "https://app/refresh",
  createConnectedAccount: (input: { organizationId: string }) =>
    simProvider.createConnectedAccount(input),
  createOnboardingLink: (input: {
    externalAccountId: string;
    returnUrl: string;
    refreshUrl: string;
  }) => simProvider.createOnboardingLink(input),
};

describe("marketplace payouts — balance", () => {
  it("derives available balance from paid earnings minus payouts", async () => {
    const { store, sellerOrg } = await sellerWithBalance();
    const balances = await getSellerBalances(store, sellerOrg.id);
    expect(balances).toHaveLength(1);
    expect(balances[0]).toMatchObject({
      currency: "usd",
      earned: 8500,
      paidOut: 0,
      pending: 0,
      available: 8500,
    });
  });
});

describe("marketplace payouts — onboarding", () => {
  it("simulated onboarding activates the account immediately", async () => {
    const { store, sellerUser, sellerOrg } = await sellerWithBalance();
    const result = await startPayoutOnboarding(store, actor(sellerOrg.id, sellerUser.id), onboardingOpts);
    expect(result.status).toBe("active");
    expect((await getPayoutAccount(store, sellerOrg.id))?.status).toBe("active");
  });

  it("live onboarding returns a redirect and leaves the account pending", async () => {
    const { store, sellerUser, sellerOrg } = await sellerWithBalance();
    const result = await startPayoutOnboarding(store, actor(sellerOrg.id, sellerUser.id), {
      ...onboardingOpts,
      createConnectedAccount: async () => ({ externalAccountId: "acct_live", status: "onboarding" }),
      createOnboardingLink: async () => ({ mode: "redirect", url: "https://connect/onboard" }),
    });
    expect(result.status).toBe("redirect");
    if (result.status !== "redirect") throw new Error("unreachable");
    expect(result.url).toBe("https://connect/onboard");
    expect((await getPayoutAccount(store, sellerOrg.id))?.status).toBe("onboarding");
  });
});

describe("marketplace payouts — withdraw", () => {
  it("refuses to withdraw without an active account", async () => {
    const { store, sellerUser, sellerOrg } = await sellerWithBalance();
    await expect(
      requestPayout(store, actor(sellerOrg.id, sellerUser.id), { currency: "usd" }, {
        createTransfer: (input) => simProvider.createTransfer(input),
      }),
    ).rejects.toBeInstanceOf(MarketplaceError);
  });

  it("withdraws the full balance, settles it, and blocks a second empty withdrawal", async () => {
    const { store, sellerUser, sellerOrg } = await sellerWithBalance();
    await startPayoutOnboarding(store, actor(sellerOrg.id, sellerUser.id), onboardingOpts);

    const payout = await requestPayout(store, actor(sellerOrg.id, sellerUser.id), { currency: "usd" }, {
      createTransfer: (input) => simProvider.createTransfer(input),
    });
    expect(payout.amount).toBe(8500);
    expect(payout.status).toBe("paid");

    // Balance is now drained.
    const balances = await getSellerBalances(store, sellerOrg.id);
    expect(balances[0].available).toBe(0);
    expect(balances[0].paidOut).toBe(8500);
    expect(await listPayouts(store, sellerOrg.id)).toHaveLength(1);

    // Nothing left to withdraw.
    await expect(
      requestPayout(store, actor(sellerOrg.id, sellerUser.id), { currency: "usd" }, {
        createTransfer: (input) => simProvider.createTransfer(input),
      }),
    ).rejects.toBeInstanceOf(MarketplaceError);
  });

  it("a live transfer records the provider transfer id and pending reduces the balance", async () => {
    const { store, sellerUser, sellerOrg } = await sellerWithBalance();
    await startPayoutOnboarding(store, actor(sellerOrg.id, sellerUser.id), {
      ...onboardingOpts,
      createConnectedAccount: async () => ({ externalAccountId: "acct_live", status: "active" }),
      createOnboardingLink: async () => ({ mode: "simulated" }),
    });
    const payout = await requestPayout(store, actor(sellerOrg.id, sellerUser.id), { currency: "usd" }, {
      createTransfer: async () => ({ mode: "transferred", externalTransferId: "tr_123" }),
    });
    expect(payout.externalTransferId).toBe("tr_123");
    expect(payout.status).toBe("paid");
  });
});

describe("marketplace payouts — webhooks", () => {
  it("account.updated flips the stored account status", async () => {
    const { store, sellerUser, sellerOrg } = await sellerWithBalance();
    await startPayoutOnboarding(store, actor(sellerOrg.id, sellerUser.id), {
      ...onboardingOpts,
      createConnectedAccount: async () => ({ externalAccountId: "acct_x", status: "onboarding" }),
      createOnboardingLink: async () => ({ mode: "redirect", url: "u" }),
    });
    const res = await fulfillPayoutWebhook(store, "simulated", {
      type: "account.updated",
      externalAccountId: "acct_x",
      accountStatus: "active",
      reference: null,
      externalTransferId: null,
    });
    expect(res).toEqual({ handled: true, kind: "account" });
    expect((await getPayoutAccount(store, sellerOrg.id))?.status).toBe("active");
  });

  it("payout.failed on a pending payout marks it failed and restores the balance", async () => {
    const { store, sellerOrg } = await sellerWithBalance();
    // A pending payout directly in the ledger (as a live transfer would be before settlement).
    const payout = await store.createMarketplacePayout({
      organizationId: sellerOrg.id,
      provider: "stripe",
      externalAccountId: "acct_x",
      reference: "po_ref",
      amount: 8500,
      currency: "usd",
      status: "pending",
    });
    // Pending reduces available.
    expect((await getSellerBalances(store, sellerOrg.id))[0].available).toBe(0);

    const res = await fulfillPayoutWebhook(store, "stripe", {
      type: "payout.failed",
      externalAccountId: "acct_x",
      accountStatus: null,
      reference: "po_ref",
      externalTransferId: null,
    });
    expect(res).toEqual({ handled: true, kind: "payout" });
    expect((await store.getMarketplacePayout(payout.id))?.status).toBe("failed");
    // Failed payouts no longer hold the balance.
    expect((await getSellerBalances(store, sellerOrg.id))[0].available).toBe(8500);

    // Unknown reference is not handled.
    const unknown = await fulfillPayoutWebhook(store, "stripe", {
      type: "payout.paid",
      externalAccountId: null,
      accountStatus: null,
      reference: "po_missing",
      externalTransferId: null,
    });
    expect(unknown).toEqual({ handled: false, kind: "unknown" });
  });
});
