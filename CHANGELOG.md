# Changelog

## Sprint 019 - Embeddings & Semantic Retrieval — 2026-07-08

Added:

- **Embeddings for the Knowledge Vault** — sources are chunked into overlapping
  passages (`src/modules/knowledge/embeddings.ts`: `chunkPassages`, default ~800
  tokens / ~100 overlap, configurable) and embedded via an injected `Embedder`
  port (no provider SDK). A zero-setup deterministic **local embedder** is the
  default. Each chunk records its embedding model id + dimension so a model change
  can trigger a re-embed. Migration `0018_embeddings.sql` adds the pgvector column
  + HNSW index to the chunk table and an indexing state to sources.
- **Hybrid retrieval** — chat retrieval is now semantic (vector top-k) **merged
  with** the existing lexical signal, deduped by chunk, keeping the grounded-answer
  contract. PostgreSQL uses pgvector cosine search; the in-memory store computes
  cosine in code so behavior is identical in tests/dev. Retrieval stays strictly
  org- and employee-assignment-scoped.
- **Indexing service** (`src/modules/knowledge/indexing.ts`) — chunk → embed →
  store, setting the source's indexing state (Indexing / Ready / Failed). Respects
  the org's model access mode (managed → budget/mid + cost recorded via a new
  non-billable `embedding` task type; BYOK → cost 0; frontier is BYOK-only), and a
  backfill (`backfillOrganization` + `scripts/backfill-embeddings.ts`) that is
  idempotent and re-embeds on source or model change.
- **UI** — a Knowledge source card now shows its search-indexing state so a
  manager knows when a source is searchable. Terminology-clean (no chunk/vector
  wording in the UI).

## Sprint 018 - Performance Review (Evaluation) — 2026-07-08

Added:

- **Performance Review** (`src/modules/performance/`) — a Growth+ capability to
  score an AI Employee against real situations and watch quality improve as the
  DNA is refined. A **Scorecard** of weighted **Criteria** is run as a **Review
  Run** against a pinned Employee DNA version, producing per-criterion
  **Review Results** and an overall score, plus a trend across runs. Internal
  words (eval / rubric / test case / grader) never appear in the UI.
- **Grading engine** (`scoring.ts`, pure) — deterministic methods (`contains`,
  `exact`, `regex`, `no_refusal`) grade with zero model calls; `reviewer` /
  `grounded` grade via an injected `Reviewer` port over the Model Hub. A case
  passes only when every criterion passes; the score is weight-normalized.
- **Persistence** — `performance_scorecard`, `performance_criterion`,
  `performance_review_case`, `performance_review_run`, `performance_review_result`
  (migration `0017_performance.sql`), org-scoped in both stores.
- **UI** — `/dashboard/performance` (+ scorecard detail) and
  `/dashboard/employees/[id]/performance` (per-criterion results, overall score,
  and a score-over-time trend). Starter orgs see a locked upgrade state; runs are
  refused server-side for Starter.
- **Cost** — model-graded criteria record a usage-cost event (Sprint 016 capture;
  BYOK → 0) via a new non-billable `performance_review` task type; deterministic
  grading is free. Grading respects the org's model access mode. Permissions:
  `performance.view` (all roles), `performance.manage` (owner/admin/builder).

## Sprint 017 - Metered Overage Billing (Managed Mode) — 2026-07-08

Added:

- **Overage policy per org** — `hard_cap` (default; block at quota) or
  `pay_as_you_go` (continue past quota, metered). Pay-as-you-go is offered only to
  `managed` orgs (owner/admin, audited; requires a payment method in live mode).
  BYOK orgs are never metered for tokens.
- **Metered accrual** — a managed pay-as-you-go org accrues one overage line per
  interaction past quota at the managed per-interaction price (Sprint 016), in a
  new `billing_overage_items` table (migration `0016_overage.sql`). Counts are
  derived from usage events. An optional **spend cap** reverts to hard-cap for the
  rest of the period once reached — enforced server-side at the interaction path.
- **Charging via the provider** — `BillingProvider.reportOverageUsage` reports the
  period's usage (Stripe metered usage records; simulated mode accrues + displays
  but never charges, clearly labeled "not charged"). The `invoice.finalized`
  webhook reconciles reported lines to charged; org resolved from stored ids.
- **Customer surfacing** — `/dashboard/usage` shows overage-to-date (quantity +
  amount), the per-interaction rate, and the spend cap, with a clear disclosure
  before enabling pay-as-you-go.
- **Operator view** — `/operator/margin` now includes overage revenue vs. its
  token cost and blended margin, per plan and per org, segmented managed vs. BYOK.

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
