# Billing module (Sprint 015)

Subscription billing and plan entitlements for the self-serve SMB product. Builds
directly on `llm_usage_events` (the interaction quota is derived from usage
events, not a parallel counter).

## Layout

- `plans.ts` — **code-authoritative** plan catalog (Starter / Growth / Scale):
  prices + hard entitlements + overage behavior. The one place prices live.
- `entitlements.ts` — **pure** limit math: `canHireEmployee`,
  `canAddKnowledgeSource`, `canAddConnection`, `withinInteractionQuota`.
- `metadata.ts` — status labels, billable task types, current-period helpers.
- `providers/` — `BillingProvider` adapter interface + `StripeBillingProvider`
  and `SimulatedBillingProvider`. Simulated is selected whenever
  `STRIPE_SECRET_KEY` is absent, so dev/tests never hit the network or charge.
- `service.ts` — server orchestration: plan resolution, entitlement enforcement
  (`assertCan*` / `assertWithinInteractionQuota`), plan changes, portal, and
  webhook application. Emits metadata-only billing + audit events.
- `schema.ts` / `actions.ts` — Zod validation + server actions (permission
  checks; org resolved from the session, never the client).
- `webhook.ts` — verify signature → parse → apply. Org resolved from stored ids.

## Enforcement points (server-side, deny-by-default)

- Hiring Studio create → `assertCanHireEmployee`
- Knowledge Vault create (text / url / file) → `assertCanAddKnowledgeSource`
- Channel / connection create (web / messaging / voice) → `assertCanAddConnection`
- Employee Chat runtime turn (before reply) → `assertWithinInteractionQuota`

On a limit hit these throw an `EntitlementError` whose message is a clear,
human, upgrade-oriented sentence in Taurus voice — surfaced directly to the UI.

## Permissions

- `billing.view` — all roles (see plan + usage).
- `billing.manage` — owner/admin only (upgrade/downgrade/cancel/open portal).

## Security

- No card data ever touches Taurus — Stripe Checkout + Billing Portal only.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are server-only; never
  `NEXT_PUBLIC_*`. Webhook signatures are verified when the secret is set.
- Billing + audit events are metadata only — never card, email, or raw payloads.
- Every organization gets a Starter subscription implicitly on creation.
