import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import {
  publishListing,
  setListingPrice,
  startHirePurchase,
  fulfillMarketplacePayment,
  listSellerPayments,
  MarketplaceError,
} from "@/modules/marketplace/service";
import {
  computeRevenueSplit,
  availablePaymentProviders,
  getMarketplacePaymentProvider,
} from "@/modules/marketplace/payments";
import {
  majorToMinor,
  formatMoney,
  isPricedListing,
  isSupportedCurrency,
} from "@/modules/marketplace/pricing";
import { SimulatedPaymentProvider } from "@/modules/marketplace/payments/simulated";
import { StripeMarketplacePaymentProvider } from "@/modules/marketplace/payments/stripe";
import { RazorpayPaymentProvider } from "@/modules/marketplace/payments/razorpay";

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
      companyDescription: "SELLER_SECRET",
      productsAndServices: "SELLER_SECRET",
      targetCustomers: "SELLER_SECRET",
      brandValues: ["secret"],
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

describe("marketplace payments — revenue split + pricing helpers", () => {
  it("splits gross into platform fee (floor) + seller net", () => {
    expect(computeRevenueSplit(10_000, 1500)).toEqual({ platformFee: 1500, sellerNet: 8500 });
    // Rounds the fee DOWN so the seller is never short-changed.
    expect(computeRevenueSplit(999, 1500)).toEqual({ platformFee: 149, sellerNet: 850 });
    expect(computeRevenueSplit(100, 0)).toEqual({ platformFee: 0, sellerNet: 100 });
  });

  it("pricing helpers convert + format + classify", () => {
    expect(majorToMinor("12.50", "usd")).toBe(1250);
    expect(majorToMinor("-1", "usd")).toBeNull();
    expect(formatMoney(1250, "usd")).toBe("$12.50 USD");
    expect(formatMoney(49900, "inr")).toBe("₹499.00 INR");
    expect(isSupportedCurrency("inr")).toBe(true);
    expect(isSupportedCurrency("xyz")).toBe(false);
    expect(isPricedListing({ priceModel: "one_time", priceAmount: 100 })).toBe(true);
    expect(isPricedListing({ priceModel: "free", priceAmount: null })).toBe(false);
    expect(isPricedListing({ priceModel: "one_time", priceAmount: 0 })).toBe(false);
  });

  it("defaults to the simulated provider with no keys configured", () => {
    expect(availablePaymentProviders()).toEqual([]);
    expect(getMarketplacePaymentProvider("stripe").id).toBe("simulated");
    expect(getMarketplacePaymentProvider("razorpay").id).toBe("simulated");
  });
});

describe("marketplace payments — set price", () => {
  it("sets a one-time price, rejects bad input, and clears back to free", async () => {
    const { store, sellerUser, sellerOrg, employee } = await setup();
    const listing = await publishListing(store, actor(sellerOrg.id, sellerUser.id), {
      employeeId: employee.id,
    });

    const priced = await setListingPrice(store, actor(sellerOrg.id, sellerUser.id), {
      listingId: listing.id,
      priceModel: "one_time",
      priceAmount: 4900,
      priceCurrency: "usd",
    });
    expect(priced.priceModel).toBe("one_time");
    expect(priced.priceAmount).toBe(4900);
    expect(priced.priceCurrency).toBe("usd");

    await expect(
      setListingPrice(store, actor(sellerOrg.id, sellerUser.id), {
        listingId: listing.id,
        priceModel: "one_time",
        priceAmount: 0,
        priceCurrency: "usd",
      }),
    ).rejects.toBeInstanceOf(MarketplaceError);
    await expect(
      setListingPrice(store, actor(sellerOrg.id, sellerUser.id), {
        listingId: listing.id,
        priceModel: "one_time",
        priceAmount: 100,
        priceCurrency: "zzz",
      }),
    ).rejects.toBeInstanceOf(MarketplaceError);

    const free = await setListingPrice(store, actor(sellerOrg.id, sellerUser.id), {
      listingId: listing.id,
      priceModel: "free",
    });
    expect(free.priceModel).toBe("free");
    expect(free.priceAmount).toBeNull();
  });
});

describe("marketplace payments — purchase flow", () => {
  async function pricedListing() {
    const ctx = await setup();
    const listing = await publishListing(ctx.store, actor(ctx.sellerOrg.id, ctx.sellerUser.id), {
      employeeId: ctx.employee.id,
    });
    await setListingPrice(ctx.store, actor(ctx.sellerOrg.id, ctx.sellerUser.id), {
      listingId: listing.id,
      priceModel: "one_time",
      priceAmount: 10_000,
      priceCurrency: "usd",
    });
    const fresh = (await ctx.store.getMarketplaceListing(listing.id))!;
    return { ...ctx, listing: fresh };
  }

  it("simulated purchase completes in-process, clones DNA only, records the split", async () => {
    const { store, buyerUser, buyerOrg, sellerOrg, listing } = await pricedListing();

    const result = await startHirePurchase(
      store,
      actor(buyerOrg.id, buyerUser.id),
      { listingId: listing.id },
      {
        provider: "simulated",
        feeBps: 1500,
        successUrl: "https://app/s",
        cancelUrl: "https://app/c",
        createCheckout: async () => ({ mode: "simulated" }),
      },
    );

    expect(result.status).toBe("completed");
    if (result.status !== "completed") throw new Error("unreachable");
    expect(result.payment.status).toBe("paid");
    expect(result.payment.platformFee).toBe(1500);
    expect(result.payment.sellerNet).toBe(8500);
    expect(result.hire.status).toBe("approved");

    // DNA cloned into the BUYER org.
    const clonedId = result.hire.hirerEmployeeId as string;
    const clonedDna = await store.getPublishedEmployeeDna(buyerOrg.id, clonedId);
    expect(clonedDna?.dna.identity.roleSummary).toBe("Senior Support Specialist");
    // SECURITY: no vault crosses over; seller narrative never present.
    expect(await store.listVaultsForEmployee(buyerOrg.id, clonedId)).toHaveLength(0);
    expect(JSON.stringify(clonedDna?.dna.companyContext)).not.toContain("SELLER_SECRET");

    // Seller earnings ledger shows the net.
    const earnings = await listSellerPayments(store, sellerOrg.id);
    expect(earnings).toHaveLength(1);
    expect(earnings[0].sellerNet).toBe(8500);
    expect(earnings[0].status).toBe("paid");
  });

  it("rejects buying your own listing and buying a free listing", async () => {
    const { store, sellerUser, sellerOrg, buyerUser, buyerOrg, listing } = await pricedListing();
    await expect(
      startHirePurchase(
        store,
        actor(sellerOrg.id, sellerUser.id),
        { listingId: listing.id },
        {
          provider: "simulated",
          feeBps: 1500,
          successUrl: "s",
          cancelUrl: "c",
          createCheckout: async () => ({ mode: "simulated" }),
        },
      ),
    ).rejects.toBeInstanceOf(MarketplaceError);

    // Make it free again → purchase is refused (use request-to-hire instead).
    await setListingPrice(store, actor(sellerOrg.id, sellerUser.id), {
      listingId: listing.id,
      priceModel: "free",
    });
    await expect(
      startHirePurchase(
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
      ),
    ).rejects.toBeInstanceOf(MarketplaceError);
  });

  it("redirect flow: pending until a webhook settles it, and settlement is idempotent", async () => {
    const { store, buyerUser, buyerOrg, listing } = await pricedListing();

    const result = await startHirePurchase(
      store,
      actor(buyerOrg.id, buyerUser.id),
      { listingId: listing.id },
      {
        provider: "stripe",
        feeBps: 1500,
        successUrl: "https://app/s",
        cancelUrl: "https://app/c",
        createCheckout: async (input) => ({
          mode: "redirect",
          url: `https://checkout/${input.reference}`,
          externalPaymentId: "cs_test_123",
        }),
      },
    );
    expect(result.status).toBe("redirect");
    if (result.status !== "redirect") throw new Error("unreachable");
    expect(result.payment.status).toBe("pending");
    expect(result.payment.externalPaymentId).toBe("cs_test_123");
    // No hire/clone yet.
    expect(await store.listMarketplacePaymentsForBuyer(buyerOrg.id)).toHaveLength(1);

    // Webhook: paid → settles (clone + mark paid).
    const first = await fulfillMarketplacePayment(store, "stripe", {
      type: "paid",
      reference: result.payment.reference,
      externalPaymentId: "cs_test_123",
    });
    expect(first).toEqual({ handled: true, status: "paid" });

    const afterFirst = await store.getMarketplacePaymentByReference(result.payment.reference);
    expect(afterFirst?.status).toBe("paid");
    const hireId = afterFirst?.hireId as string;
    expect(hireId).toBeTruthy();

    // Replaying the SAME event does not create a second hire/clone.
    const second = await fulfillMarketplacePayment(store, "stripe", {
      type: "paid",
      reference: result.payment.reference,
      externalPaymentId: "cs_test_123",
    });
    expect(second.status).toBe("paid");
    const afterSecond = await store.getMarketplacePaymentByReference(result.payment.reference);
    expect(afterSecond?.hireId).toBe(hireId); // same hire, not a new one
  });

  it("a failed webhook marks a pending payment failed; unknown references are ignored", async () => {
    const { store, buyerUser, buyerOrg, listing } = await pricedListing();
    const result = await startHirePurchase(
      store,
      actor(buyerOrg.id, buyerUser.id),
      { listingId: listing.id },
      {
        provider: "razorpay",
        feeBps: 1500,
        successUrl: "s",
        cancelUrl: "c",
        createCheckout: async (input) => ({
          mode: "redirect",
          url: "https://rzp/x",
          externalPaymentId: `plink_${input.reference}`,
        }),
      },
    );
    if (result.status !== "redirect") throw new Error("unreachable");

    const failed = await fulfillMarketplacePayment(store, "razorpay", {
      type: "failed",
      reference: result.payment.reference,
      externalPaymentId: null,
    });
    expect(failed).toEqual({ handled: true, status: "failed" });
    expect((await store.getMarketplacePaymentByReference(result.payment.reference))?.status).toBe(
      "failed",
    );

    const unknown = await fulfillMarketplacePayment(store, "razorpay", {
      type: "paid",
      reference: "mp_nope",
      externalPaymentId: null,
    });
    expect(unknown).toEqual({ handled: false, status: "unknown" });
  });
});

describe("marketplace payments — provider parsing + signatures", () => {
  it("simulated provider parses a JSON envelope and accepts unsigned webhooks", async () => {
    const p = new SimulatedPaymentProvider();
    expect(await p.verifyWebhook("{}", null)).toBe(true);
    expect(p.parseWebhookEvent(JSON.stringify({ reference: "mp_1", status: "paid" }))).toEqual({
      type: "paid",
      reference: "mp_1",
      externalPaymentId: null,
    });
  });

  it("stripe parses checkout.session.completed and verifies its HMAC signature", async () => {
    const secret = "whsec_test";
    const p = new StripeMarketplacePaymentProvider({ secretKey: "sk", webhookSecret: secret });
    const body = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_status: "paid", client_reference_id: "mp_ref" } },
    });
    expect(p.parseWebhookEvent(body)).toEqual({
      type: "paid",
      reference: "mp_ref",
      externalPaymentId: "cs_1",
    });

    const ts = "1700000000";
    const sig = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(await p.verifyWebhook(body, `t=${ts},v1=${sig}`)).toBe(true);
    expect(await p.verifyWebhook(body, `t=${ts},v1=deadbeef`)).toBe(false);
    expect(await p.verifyWebhook(body, null)).toBe(false);
  });

  it("razorpay parses payment_link.paid and verifies its HMAC signature", async () => {
    const secret = "rzp_whsec";
    const p = new RazorpayPaymentProvider({ keyId: "k", keySecret: "s", webhookSecret: secret });
    const body = JSON.stringify({
      event: "payment_link.paid",
      payload: { payment_link: { entity: { id: "plink_1", reference_id: "mp_ref" } } },
    });
    expect(p.parseWebhookEvent(body)).toEqual({
      type: "paid",
      reference: "mp_ref",
      externalPaymentId: "plink_1",
    });

    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(await p.verifyWebhook(body, sig)).toBe(true);
    expect(await p.verifyWebhook(body, "wrong")).toBe(false);
  });
});
