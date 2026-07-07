# Changelog

## Sprint 016 - Usage & Limits Dashboard + Cost/Margin Tracking — 2026-07-07

Added:

- **Cost capture on every interaction** — a code-authoritative model pricing
  layer (`src/modules/usage/model-pricing.ts`: cost tier + managed sell price on
  top of the Model Hub token prices) and a write-time `cost_usd` + price snapshot
  + `byok` flag on each `llm_usage_events` row (migration `0015_usage_costs.sql`).
  BYOK interactions cost Taurus 0; the prompt-cache discount is applied.
- **Customer Usage dashboard** (`/dashboard/usage`, `usage.view` for all roles)
  — interactions vs. plan quota for the period, breakdowns by AI Employee and by
  channel, a daily trend, and 80% / 100% quota banners. Never shows Taurus cost.
- **Operator cost/margin view** (`/operator/margin`) — revenue, serving cost,
  gross margin %, and markup per plan and per organization, with a "margin at
  risk" flag, gated by a server-only platform-operator allowlist
  (`PLATFORM_OPERATOR_USER_IDS`). A normal user (any org role) gets 404.
- **Model access mode** per organization (`managed` | `byok`, default `managed`)
  — changeable by owner/admin only, audited. Frontier-tier models are BYOK-only
  (blocked for an AI Employee in managed mode; filtered from automatic routing).
- **Margin guardrail** — new AI Employees default to a budget-tier model; the
  Model Hub catalog labels each model's cost tier. A managed per-interaction sell
  price is defined and displayed (metered charging is Sprint 017).

## Sprint 015 - Billing, Plans & Subscriptions + Functionality Audit — 2026-07-07

Added:

- **Billing, Plans & Subscriptions** — code-authoritative plans catalog
  (Starter / Growth / Scale), per-organization subscription state (migration
  `0014_billing.sql`: `billing_subscriptions`, `billing_customers`,
  `billing_events`), a `BillingProvider` adapter with real Stripe + simulated
  providers (simulated by default when `STRIPE_SECRET_KEY` is absent),
  server-side entitlement enforcement (employees / knowledge / connections /
  interaction quota), the billing dashboard (`/dashboard/settings/billing` and
  `/plans`), and the Stripe webhook (`/api/webhooks/billing/stripe`). Every new
  organization starts on Starter automatically; `billing.view` for all roles,
  `billing.manage` for owner/admin.
- **Functionality audit & repair** — a route-by-route audit
  (`05_reports/FUNCTIONALITY_AUDIT.md`) plus six repair batches: audit trail,
  onboarding polish, employee usage/activity, error surfacing, voice credential
  parity, and real webhook signature verification (SendGrid / Telnyx / Vonage);
  and a real Connections "Test" action.
- **Reports** — `05_reports/FUNCTIONALITY_AUDIT.md` and
  `05_reports/RUNTIME_VERIFICATION.md`.

Changed:

- **Plan catalog aligned to the authoritative spec** — Starter 1 AI Employee /
  5 knowledge / 1 connection / 100 interactions (free); Growth 3 / 50 / unlimited
  connections / 2,000 ($49); Scale 10 / 500 / unlimited / 10,000 ($199, soft-cap).
- **Per-plan feature flags** (`features.performanceReview`, `features.byok`) — on
  for Growth and Scale, off for Starter. **BYOK** (bring-your-own model keys) is
  now gated server-side at the credential save action; a Starter org is refused
  with an upgrade message before any key is stored. Unlimited connections are
  represented as `Infinity` and rendered as "Unlimited" in the usage meter.

Numbering: the billing sprint is **Sprint 015** (it follows 014 Connections). The
migration file keeps its independent number `0014_billing.sql`.

## v1 - 2026-07-06

Created Taurus AI Phase 0 Execution Pack.

Included:

- Founder brief
- Taurus Constitution
- Product terminology
- MVP scope
- User journeys
- UI requirements
- Product phase roadmap
- Technical architecture
- Database schema
- API specification
- Security model
- AI runtime
- Voice foundation
- Collaboration protocol foundation
- Stack decision
- Definition of Done
- Sprint 1 backlog
- Coding standards
- Claude prompts 000 through 010
- Investor narrative
