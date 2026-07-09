/**
 * Seed rich, realistic marketplace demo data so every marketplace view is full
 * (Sprint 035 follow-up — demo only).
 *
 * Usage:  DATABASE_URL=postgres://…  npx tsx scripts/seed-marketplace.ts [--force]
 *
 * Builds several seller organizations with published AI Employee listings (free
 * + priced, some with knowledge-vault descriptions and hire-gated reviews), then
 * attaches purchases, earnings, a connected payout account, and a payout to the
 * demo org (founder@demo.taurus.ai — created by db/seed.sql) so its Earnings /
 * Purchases / My-listings views are populated when you sign in as that user.
 *
 * Idempotent guard: it skips if the marker seller already exists (pass --force
 * to seed another batch anyway). Reuses the real service functions so the seeded
 * data is exactly what the app itself would produce. Safe for local/demo only —
 * never run against production.
 */

import { getStore, type DataStore } from "@/lib/db/store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import type { MarketplaceActor } from "@/modules/marketplace/service";
import {
  publishListing,
  setListingPrice,
  startHirePurchase,
  requestHire,
  approveHire,
  submitReview,
  startPayoutOnboarding,
  requestPayout,
} from "@/modules/marketplace/service";
import { getMarketplacePayoutProvider, platformFeeBps } from "@/modules/marketplace/payments";

const DEMO_EMAIL = "founder@demo.taurus.ai";
const MARKER_EMAIL = "seed.seller.northwind@demo.taurus.ai";

const sim = getMarketplacePayoutProvider("simulated");
const buyOpts = {
  provider: "simulated" as const,
  feeBps: platformFeeBps(),
  successUrl: "https://demo/success",
  cancelUrl: "https://demo/cancel",
  createCheckout: async () => ({ mode: "simulated" as const }),
};

function actor(organizationId: string, userId: string): MarketplaceActor {
  return { organizationId, userId };
}

/** A believable DNA for a role. companyContext is intentionally rich (it gets blanked on publish). */
function dnaFor(role: {
  mission: string;
  roleSummary: string;
  goals: string[];
  success: string[];
  primary: string[];
  tone: EmployeeDnaV1["communicationStyle"]["tone"];
  brandVoice: string;
}): EmployeeDnaV1 {
  const base = createEmptyDnaV1();
  return {
    ...base,
    identity: {
      mission: role.mission,
      roleSummary: role.roleSummary,
      primaryGoals: role.goals,
      successCriteria: role.success,
    },
    responsibilities: {
      primaryResponsibilities: role.primary,
      secondaryResponsibilities: ["Keep internal notes tidy", "Flag trends to the team"],
      outOfScopeResponsibilities: ["Legal advice", "Anything requiring a human signature"],
    },
    communicationStyle: {
      ...base.communicationStyle,
      tone: role.tone,
      brandVoice: role.brandVoice,
      languages: ["English"],
    },
    decisionStyle: {
      ...base.decisionStyle,
      whenToEscalate: "When a request needs a policy exception or a refund above the set limit.",
      decisionBoundaries: ["Never promise dates without confirmation", "Escalate legal questions"],
    },
    boundaries: {
      ...base.boundaries,
      allowedTopics: ["Product help", "Onboarding", "Best practices"],
      restrictedTopics: ["Pricing negotiations", "Personnel matters"],
      neverDo: ["Share another customer's data", "Guess at compliance answers"],
    },
    companyContext: {
      companyDescription: "Seed company narrative (blanked on publish).",
      productsAndServices: "Seed products (blanked on publish).",
      targetCustomers: "Seed customers (blanked on publish).",
      brandValues: ["Trust", "Speed"],
    },
  };
}

async function makeUserOrg(store: DataStore, email: string, fullName: string, orgName: string) {
  let user = await store.getUserByEmail(email);
  if (!user) user = await store.createUser({ email, fullName });
  const { organization } = await createOrganizationForUser(store, user.id, { name: orgName });
  return { user, organization };
}

/** Create an employee with published DNA, ready to list. */
async function makeEmployee(
  store: DataStore,
  org: string,
  userId: string,
  name: string,
  roleTitle: string,
  dna: EmployeeDnaV1,
) {
  const employee = await store.createEmployee({ organizationId: org, name, roleTitle });
  await store.saveEmployeeDnaDraft({ organizationId: org, employeeId: employee.id, dna, userId });
  await store.publishEmployeeDna({ organizationId: org, employeeId: employee.id, userId });
  return employee;
}

async function main() {
  const store = getStore();
  const force = process.argv.includes("--force");

  if (!force && (await store.getUserByEmail(MARKER_EMAIL))) {
    console.log("Marketplace demo data already seeded. Pass --force to add another batch.");
    return;
  }

  console.log(`Platform fee: ${platformFeeBps() / 100}%`);

  // --- Buyer orgs that hire + review (populate reviews on sellers) ----------
  const globex = await makeUserOrg(store, "seed.buyer.globex@demo.taurus.ai", "Globex Ops", "Globex");
  const initech = await makeUserOrg(store, "seed.buyer.initech@demo.taurus.ai", "Initech Ops", "Initech");

  // --- Seller catalog -------------------------------------------------------
  const northwind = await makeUserOrg(
    store,
    MARKER_EMAIL,
    "Northwind Support",
    "Northwind Support Co",
  );
  const nwEmp = await makeEmployee(
    store,
    northwind.organization.id,
    northwind.user.id,
    "Nova",
    "Senior Support Specialist",
    dnaFor({
      mission: "Resolve customer issues fast while keeping every interaction on-brand.",
      roleSummary: "Senior Support Specialist",
      goals: ["Resolve tickets on first contact", "Keep CSAT above 92%"],
      success: ["CSAT > 92%", "Median first response < 5 min"],
      primary: ["Answer product questions", "Troubleshoot account issues", "Process refunds within policy"],
      tone: "Warm",
      brandVoice: "Friendly, concise, never condescending.",
    }),
  );
  // A vault (description shows on the resume; content is never shared).
  const nwVault = await store.createKnowledgeVault({
    organizationId: northwind.organization.id,
    name: "Refund & returns policy",
    description: "How refunds, returns, and exceptions are handled end-to-end.",
  });
  await store.createKnowledgeSource({
    organizationId: northwind.organization.id,
    vaultId: nwVault.id,
    name: "Refund policy v4",
    sourceType: "text",
    status: "ready",
  });
  await store.assignVaultToEmployee({
    organizationId: northwind.organization.id,
    employeeId: nwEmp.id,
    vaultId: nwVault.id,
  });
  const nwListing = await publishListing(
    store,
    actor(northwind.organization.id, northwind.user.id),
    {
      employeeId: nwEmp.id,
      title: "Nova — Senior Support Specialist",
      headline: "First-contact resolution with a 92%+ CSAT track record.",
      summary:
        "A battle-tested support specialist tuned for SaaS teams: fast, empathetic, and policy-aware. Clone the DNA and attach your own knowledge to go live in minutes.",
      includeVaults: true,
    },
  );
  await setListingPrice(store, actor(northwind.organization.id, northwind.user.id), {
    listingId: nwListing.id,
    priceModel: "one_time",
    priceAmount: 4900,
    priceCurrency: "usd",
  });

  const atlas = await makeUserOrg(store, "seed.seller.atlas@demo.taurus.ai", "Atlas Sales", "Atlas Sales");
  const atlasEmp = await makeEmployee(
    store,
    atlas.organization.id,
    atlas.user.id,
    "Aria",
    "SDR / Sales Development",
    dnaFor({
      mission: "Book qualified meetings by starting genuinely helpful conversations.",
      roleSummary: "Sales Development Representative",
      goals: ["Book 20 qualified meetings/mo", "Keep reply rates healthy"],
      success: ["Reply rate > 8%", "Show-rate > 70%"],
      primary: ["Qualify inbound leads", "Personalize outreach", "Hand off to AEs cleanly"],
      tone: "Direct",
      brandVoice: "Direct, curious, respectful of the prospect's time.",
    }),
  );
  const atlasListing = await publishListing(store, actor(atlas.organization.id, atlas.user.id), {
    employeeId: atlasEmp.id,
    title: "Aria — Sales Development Rep",
    headline: "Books qualified meetings without the spammy playbook.",
    summary: "An SDR that personalizes at scale and hands off clean, context-rich meetings.",
  });
  await setListingPrice(store, actor(atlas.organization.id, atlas.user.id), {
    listingId: atlasListing.id,
    priceModel: "one_time",
    priceAmount: 399900,
    priceCurrency: "inr",
  });

  const orbit = await makeUserOrg(store, "seed.seller.orbit@demo.taurus.ai", "Orbit Analytics", "Orbit Analytics");
  const orbitEmp = await makeEmployee(
    store,
    orbit.organization.id,
    orbit.user.id,
    "Orin",
    "Data Analyst",
    dnaFor({
      mission: "Turn raw product data into decisions the team can act on today.",
      roleSummary: "Product Data Analyst",
      goals: ["Answer data questions in plain language", "Surface weekly insights"],
      success: ["< 1 day turnaround", "Insights adopted by the team"],
      primary: ["Explain metrics", "Draft SQL", "Summarize trends"],
      tone: "Professional",
      brandVoice: "Clear, quantitative, never hand-wavy.",
    }),
  );
  const orbitListing = await publishListing(store, actor(orbit.organization.id, orbit.user.id), {
    employeeId: orbitEmp.id,
    title: "Orin — Product Data Analyst",
    headline: "Plain-language answers to your hardest product-data questions.",
    summary: "Free to hire — a solid analyst starting point you can shape with your own metrics.",
  });
  // orbitListing stays FREE (request → approve).

  const vertex = await makeUserOrg(store, "seed.seller.vertex@demo.taurus.ai", "Vertex Legal", "Vertex Legal");
  const vertexEmp = await makeEmployee(
    store,
    vertex.organization.id,
    vertex.user.id,
    "Vera",
    "Contract Reviewer",
    dnaFor({
      mission: "Speed up first-pass contract review while flagging real risk.",
      roleSummary: "Contract Review Assistant",
      goals: ["Cut first-pass review time in half", "Never miss a red-flag clause"],
      success: ["50% faster first pass", "Zero missed red flags in QA"],
      primary: ["Summarize contracts", "Flag risky clauses", "Draft redlines for a human to approve"],
      tone: "Professional",
      brandVoice: "Careful, plain-English, risk-aware.",
    }),
  );
  const vertexListing = await publishListing(store, actor(vertex.organization.id, vertex.user.id), {
    employeeId: vertexEmp.id,
    title: "Vera — Contract Review Assistant",
    headline: "Halve first-pass contract review without missing red flags.",
    summary: "A careful first-pass reviewer. Always drafts for a human to approve — never signs.",
  });
  await setListingPrice(store, actor(vertex.organization.id, vertex.user.id), {
    listingId: vertexListing.id,
    priceModel: "one_time",
    priceAmount: 12000,
    priceCurrency: "eur",
  });

  // --- Buyers hire + review the sellers (needs an approved hire to review) --
  async function buyAndReview(
    buyer: { organization: { id: string }; user: { id: string } },
    listingId: string,
    rating: number,
    comment: string,
  ) {
    await startHirePurchase(store, actor(buyer.organization.id, buyer.user.id), { listingId }, buyOpts);
    await submitReview(store, actor(buyer.organization.id, buyer.user.id), { listingId, rating, comment });
  }
  async function requestApproveReview(
    seller: { organization: { id: string }; user: { id: string } },
    buyer: { organization: { id: string }; user: { id: string } },
    listingId: string,
    rating: number,
    comment: string,
  ) {
    const hire = await requestHire(store, actor(buyer.organization.id, buyer.user.id), { listingId });
    await approveHire(store, actor(seller.organization.id, seller.user.id), hire.id);
    await submitReview(store, actor(buyer.organization.id, buyer.user.id), { listingId, rating, comment });
  }

  await buyAndReview(globex, nwListing.id, 5, "Cut our first-response time in half. Onboarding was genuinely simple.");
  await buyAndReview(initech, nwListing.id, 4, "Strong out of the box. Needed a little tuning for our tone.");
  await buyAndReview(globex, atlasListing.id, 5, "Meetings booked went up within two weeks.");
  await buyAndReview(initech, vertexListing.id, 4, "Great first-pass reviewer. We still human-approve every redline.");
  await requestApproveReview(orbit, globex, orbitListing.id, 5, "Exactly the analyst starting point we wanted.");

  // --- Demo org: seller + buyer + payouts -----------------------------------
  const demoUser = await store.getUserByEmail(DEMO_EMAIL);
  if (!demoUser) {
    console.log(`Demo user ${DEMO_EMAIL} not found — run 'npm run db:migrate:seed' first. Skipping demo-org data.`);
  } else {
    const memberships = await store.listOrganizationsForUser(demoUser.id);
    const demoOrgId = memberships[0]?.organization.id;
    if (!demoOrgId) {
      console.log("Demo user has no organization — skipping demo-org data.");
    } else {
      const demo = actor(demoOrgId, demoUser.id);

      // Demo org publishes its own priced listing.
      const sage = await makeEmployee(
        store,
        demoOrgId,
        demoUser.id,
        "Sage",
        "Customer Success Manager",
        dnaFor({
          mission: "Drive adoption and renewals by making every customer successful.",
          roleSummary: "Customer Success Manager",
          goals: ["Lift net revenue retention", "Reduce time-to-value"],
          success: ["NRR > 110%", "Faster activation"],
          primary: ["Run onboarding", "Spot churn risk early", "Drive expansion conversations"],
          tone: "Professional",
          brandVoice: "Proactive, outcomes-focused, warm.",
        }),
      );
      const sageListing = await publishListing(store, demo, {
        employeeId: sage.id,
        title: "Sage — Customer Success Manager",
        headline: "Turns onboarding into adoption, and adoption into renewals.",
        summary: "A proactive CSM tuned for NRR. Clone the DNA and attach your own playbooks.",
      });
      await setListingPrice(store, demo, {
        listingId: sageListing.id,
        priceModel: "one_time",
        priceAmount: 7500,
        priceCurrency: "usd",
      });

      // Sale #1 → connect payout account → withdraw (leaves history) → Sale #2
      // so the Earnings view shows both an available balance AND a past payout.
      await buyAndReview(globex, sageListing.id, 5, "Our activation rate jumped. Worth every cent.");
      await startPayoutOnboarding(store, demo, {
        provider: "simulated",
        returnUrl: "https://demo/r",
        refreshUrl: "https://demo/f",
        createConnectedAccount: (input) => sim.createConnectedAccount(input),
        createOnboardingLink: (input) => sim.createOnboardingLink(input),
      });
      await requestPayout(store, demo, { currency: "usd" }, {
        createTransfer: (input) => sim.createTransfer(input),
      });
      await buyAndReview(initech, sageListing.id, 4, "Solid CSM foundation; we layered our own renewal playbook on top.");

      // Demo org also BUYS from the catalog (populates Purchases + hired employees).
      await startHirePurchase(store, demo, { listingId: nwListing.id }, buyOpts);
      await startHirePurchase(store, demo, { listingId: vertexListing.id }, buyOpts);
      const freeHire = await requestHire(store, demo, { listingId: orbitListing.id });
      await approveHire(store, actor(orbit.organization.id, orbit.user.id), freeHire.id);
    }
  }

  console.log("✓ Seeded marketplace demo data:");
  console.log("  • 5 seller listings (priced USD/INR/EUR + free), with vaults + reviews");
  console.log("  • Buyer orgs Globex + Initech with hires and reviews");
  console.log(`  • Demo org (${DEMO_EMAIL}): a published priced listing with sales, a connected`);
  console.log("    payout account, a payout, remaining balance, purchases, and hired employees");
  console.log("\nSign in as the demo user to explore Marketplace → listing → resume → Earnings.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
