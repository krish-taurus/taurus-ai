# Billing Sprint (015) — Runtime Verification

Proves (or disproves) that the merged billing sprint (PR #20, merge `aa47529`)
**works end-to-end for a user**, beyond "units pass + build is clean." Exercised
in **simulated mode** (no `STRIPE_SECRET_KEY`) through the real
service/provider/enforcement code — not client mocks.

**Date:** 2026-07-07 · **Mode:** simulated billing (no Stripe keys)
**Automated evidence:** `src/tests/billing-runtime-verification.test.ts` (17
scenarios, all passing) + `src/tests/billing.test.ts` + `src/tests/end-to-end-flow.test.ts`.
Full suite **360 passing**; lint + terminology green; `next build` clean.

> **Catalog-values note (read first).** This task's checklist states some plan
> numbers (Starter cap **1** employee / **100** interactions; Growth "up to **3**";
> Growth "Performance Review + BYOK flags"). The **merged catalog** actually
> defines: Starter = **2** employees / 5 knowledge / 1 connection / **200**
> interactions; Growth = **10** / 50 / 10 / 5,000; Scale = 50 / 500 / 50 / 50,000
> (soft-cap). There are **no per-plan feature flags** (Performance Review, BYOK)
> in the implementation. The verification below asserts the **actual** merged
> values. The enforcement *mechanism* works at whatever values the catalog
> defines; the difference in the numbers/flags is a **product-catalog decision**,
> not a code defect — see the verdict. It was **not** changed unilaterally
> (changing plan economics is a product decision, and adding feature flags is
> out of scope for this task).

---

## Checklist

### A. Default plan on signup — **PASS**
- A brand-new org is created on **Starter**, `status active`, no card, no manual
  step. `createOrganizationWithOwner` seeds the subscription; `DEFAULT_PLAN_ID`
  is `starter`. Evidence: test *A › puts a brand-new organization on Starter*.
- Billing dashboard data (`getBillingOverview`) returns plan, status, a valid
  period (`currentPeriodEnd > currentPeriodStart`), and usage-vs-quota for all
  four entitlements with the real limits (2 / 5 / 1 / 200) and `simulated: true`.
  Evidence: test *A › billing dashboard data shows plan, status, period, usage*.

### B. Entitlement enforcement (server-side) — **PASS**
Each limit blocks **server-side** via a direct service call (bypassing any client
gating), raising an `EntitlementError` whose message is a clear, Taurus-voice
upgrade prompt — not a raw error code, not just a greyed-out button:
- **Hire past the Starter cap** (actual cap **2**) → blocked; message matches
  `/reached your plan's limit/` + `/upgrade/`, no error code. `hireEmployee`
  calls `assertCanHireEmployee` before `store.createEmployee`.
- **2nd connection on Starter** (cap 1) → blocked (`createWebChannel` →
  `assertCanAddConnection`).
- **6th Knowledge source on Starter** (cap 5) → blocked (`createTextSource` →
  `assertCanAddKnowledgeSource`).
- **Interaction quota** (actual **200**): after emitting 200 billable
  `llm_usage_events`, `buildEntitlementSnapshot` reports `interactionsThisPeriod
  === 200` (derived from the usage events, **not a parallel counter**) and
  `assertWithinInteractionQuota` throws — this is the exact gate the Employee
  Chat runtime calls before generating a reply (`employee-chat/service.ts`).
- Evidence: tests *B › blocks hiring…*, *…2nd connection…*, *…Knowledge past
  cap…*, *…blocks a further reply once the interaction quota is spent, reading
  from usage events*.

### C. Upgrade / downgrade (simulated) — **PASS** (feature-flags item: N/A)
- **Upgrade → Growth** applies **immediately**; the org moves to Growth and the
  employee limit lifts from 2 → 10 in the same call (a previously-blocked hire is
  now allowed). **Upgrade → Scale** lifts to 50. Evidence: test *C › upgrades to
  Growth then Scale…*.
- A **`billing_events`** row (`subscription.upgraded`) **and** an audit event
  (`billing.plan_upgraded`) are written per change. Same test.
- **Downgrade Growth → Starter** is safe: existing employees are **not deleted**
  (3 remain), the org is back on Starter, and a further hire is blocked (no
  silent deletion of over-limit resources). An audit `billing.plan_downgraded`
  is written. Evidence: test *C › downgrade is safe…*.
- **Simulated billing is clearly labeled**: `getBillingOverview(...).simulated`
  is `true` and the dashboard renders the "Simulated billing" notice
  (`billing/page.tsx` + `plans/page.tsx`).
- **N/A:** "Performance Review + BYOK flags on" — no such per-plan feature flags
  exist in the implementation (only numeric entitlements + overage behavior).
  Adding them is out of scope ("Not in this task").

### D. Permissions & isolation — **PASS**
- `billing.view` is granted to **every** role; `billing.manage` only to
  **owner/admin** (`hasPermission` matrix). Evidence: test *D › viewer/builder can
  view but cannot manage*.
- The mutations enforce this **server-side, not just by hiding buttons**:
  `choosePlanAction` and `manageBillingAction` both resolve the org from the
  session and check `hasPermission(membership.role, "billing.manage")` before
  doing anything — `billing/actions.ts:41` and `:81`. Driven with a mocked
  session, a `viewer` and a `builder` both get a permission error and the
  store/provider are **never reached** (a broken check would throw). The org is
  taken from `requireCurrentOrganization()`, never from request input. Evidence:
  `src/tests/billing-actions-permission.test.ts`.
- **Cross-org isolation**: Org A upgrading to Scale leaves Org B on Starter; each
  reads only its own subscription (`getBillingSubscription` is org-scoped).
  Evidence: test *D › one organization cannot read or change another's*.

### E. Webhook — **PASS**
- `POST /api/webhooks/billing/stripe` exists; with `STRIPE_WEBHOOK_SECRET` set the
  `StripeBillingProvider` verifies the real HMAC-SHA256 signature: a correctly
  signed body verifies, while **unsigned, wrong-signature, and tampered bodies
  are rejected**. Evidence: test *E › verifies the signature… rejects
  unsigned/invalid*.
- `parseWebhookEvent` normalizes **checkout.session.completed**,
  **customer.subscription.updated**, **customer.subscription.deleted**, and
  **invoice.payment_failed** (correct type + status + plan). Evidence: test *E ›
  parses each event type*.
- `applyWebhookEvent` resolves the org from the **stored** customer/subscription
  mapping only — an unknown id is ignored (`false`, deny-by-default), a known
  customer updates status (active → past_due → canceled across the event types).
  Never trusts client input. Evidence: test *E › resolves the organization from
  stored ids only… unknown ids are ignored*.

### F. Store parity & safety — **PASS**
- **Parity:** all 10 billing store methods exist in **both**
  `in-memory-store.ts` and `postgres-store.ts` (asserted by reading both files);
  the in-memory behavior is exercised throughout this suite. The PostgreSQL
  methods mirror the same signatures + org-scoped queries (verified by
  construction — no live database in the test environment). Evidence: test *F ›
  every billing store method exists in BOTH backends*.
- **Metadata-only:** a real upgrade's `billing_events` contain no `card`, `cvc`,
  `pan`, email (`@`), or `raw_payload`. Evidence: test *F › billing events are
  metadata-only*.
- **Secrets server-only:** the resolved **client** env exposes no Stripe key and
  there is no `NEXT_PUBLIC_STRIPE*` variable anywhere. `STRIPE_SECRET_KEY` /
  `STRIPE_WEBHOOK_SECRET` are read only in server-only modules
  (`billing/providers/*`, `lib/env`). No card data is stored. Evidence: test *F ›
  Stripe secrets are server-only*.

### G. Build health — **PASS**
- `npm test` → **360 passing**. `next lint` → clean. Terminology test → **14
  passing** (no `agent` / `prompt` / `knowledge base` in the UI).
  `npm run build` → compiles, all routes generated.

---

## Verdict

**Billing is functional end-to-end.** Every checklist item A–G is **PASS** (with
the C feature-flags sub-item **N/A** — not implemented, out of scope). The
mechanisms a customer relies on — automatic Starter on signup, server-side
entitlement blocks with upgrade messaging, instant simulated upgrade/downgrade
with events + audit, role-gated management, cross-org isolation, signed webhooks
resolving the org from stored ids, metadata-only events, server-only secrets —
all work when driven through the real code.

**One open item (product decision, not a defect):** the plan **numbers and
feature flags** stated in the task (Starter 1 / 100, Growth 3, Performance Review
+ BYOK flags) differ from the merged catalog (Starter 2 / 200, Growth 10, no
flags). The enforcement works at whatever values the catalog defines; aligning
the catalog to different numbers and adding per-plan feature flags is a
product-catalog decision (feature flags are explicitly out of scope here), so it
was **flagged, not changed unilaterally**. If those numbers are authoritative,
updating `src/modules/billing/plans.ts` (+ the value assertions in the tests) is
a small follow-up.

---

## Appendix — earlier full-app runtime verification

A prior end-to-end pass (`src/tests/end-to-end-flow.test.ts`) plus an HTTP smoke
of the booted app confirmed the surrounding subsystems billing depends on:
provider API keys (encrypt → resolve round-trip), Knowledge Vault extraction +
retrieval, the chat runtime (real gateway emits the usage event billing meters),
and independent web connections. Landing/login served `200`, `/dashboard`
redirected to login (auth guard), and the billing webhook returned
`{applied:false}` for unknown ids (deny-by-default).
