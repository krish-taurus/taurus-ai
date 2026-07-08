# Usage & Margin module (Sprint 016)

Makes usage visible to customers and cost/margin measurable for the operator,
from real `llm_usage_events` — not estimates. Builds on billing (plans,
entitlements, subscriptions) and the Model Hub catalog.

## Layout

- `model-pricing.ts` — **pure** pricing policy. Token prices live in ONE place
  (the Model Hub catalog); this layers a `costTier` (budget | mid | frontier),
  the managed sell price, the budget-tier default employee model, and
  `computeInteractionCost` (write-time cost snapshot, BYOK → 0, cache discount).
- `service.ts` — **org-scoped** customer usage: interactions vs. plan quota,
  breakdowns by AI Employee + channel, a daily trend, and the quota-banner state.
  Usage is derived from usage events; the quota is read from the plan.
- `operator.ts` — **platform-internal** cost/margin. `isPlatformOperator` gates a
  server-only allowlist (NOT an org role). `buildMarginReport` computes revenue,
  cost, margin %, markup, per plan + per org, and the "margin at risk" flag. The
  cross-tenant aggregation lives ONLY behind the gate.
- `access-mode.ts` — change an org's model access mode (managed ↔ byok) with an
  audit event. Owner/admin only (enforced in the server action).
- `metadata.ts` — channel groups + quota banner thresholds (pure).

## Where cost is captured

The model gateway computes `cost_usd` + the price snapshot on every interaction
(`gateway.ts` → `computeInteractionCost`). BYOK interactions cost Taurus 0. The
channel is threaded from `sendChatMessage` (web / messaging / voice / dashboard).

## Guardrails

- New AI Employees default to a **budget-tier** model (hiring flow).
- **Frontier** models are **BYOK-only**: blocked when picking a model for an
  Employee in managed mode (clear message), and filtered out of automatic routing
  for a managed org (defense in depth) — a flat managed plan can never run a
  high-cost frontier interaction.

## Security

- The operator allowlist is server-only (never `NEXT_PUBLIC_*`); `/operator/margin`
  returns 404 to any non-operator, including an org owner.
- Every tenant-facing query is organization-scoped; customers never see Taurus
  cost/margin or another tenant's usage.
- Usage/cost events are metadata only — no message content, no card data.

## Not in this sprint

Metered overage charging (the managed sell price is defined + displayed only),
automated model routing by query complexity, margin-risk alerting, per-token
customer-facing cost display, and a full operator console. See Sprint 017+.
