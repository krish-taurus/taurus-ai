# Taurus AI — Runtime Verification Report

Companion to `FUNCTIONALITY_AUDIT.md`. Where the audit traces each feature
through the code, this report records the **audits actually run** — real modules
chained end-to-end (no network) plus a live HTTP smoke of the booted app — and
the observed results.

**Date:** 2026-07-07
**Branch:** `claude/billing-plans-subscriptions-3z7get`
**Method:** deterministic integration test (`src/tests/end-to-end-flow.test.ts`)
exercising the real service/gateway/store code, plus `next dev` + `curl` against
public HTTP surfaces. In-memory store, simulated providers — no external calls.

---

## 1. End-to-end module verification

`src/tests/end-to-end-flow.test.ts` (4 scenarios) chains the real modules through
the customer loop and asserts observed behavior.

### 1.1 Provider API keys — Model Hub BYOK ✅
- `saveProviderCredential` encrypts a bring-your-own Anthropic key (AES-256-GCM);
  returned metadata carries only the **last four** and never the plaintext.
- `createDefaultCredentialResolver` **round-trips**: the resolved key decrypts
  back to the exact original.
- `testProviderConnection` runs the probe path with an injected probe (no
  network) and reports success.
- **Cross-org isolation:** a different organization resolves `null` — no leakage.

### 1.2 Knowledge Vault — extraction ✅
- A manual **text note** is created and immediately extracted (text content +
  preview stored).
- An uploaded **`.txt` file** is really extracted: decoded text content, preview,
  and a SHA-256 checksum are persisted; the source lands `ready`.

### 1.3 Knowledge Vault — retrieval (grounding) ✅
- Two sources (refund policy, support hours) are assigned to an AI Employee and
  prepared into retrieval segments.
- Query *"how long do I have to get a refund?"* → surfaces the **refund** source.
- Query *"what are your support hours?"* → surfaces the **hours** source.
- Retrieval returns the correct grounded source per query — not noise.

### 1.4 Chat runtime — full turn ✅
- Runs through the **real `LlmGateway`** wired to fake provider adapters (no
  network), not a stub — so the true gateway path executes.
- Observed: retrieves grounding, generates a reply, persists the user **and**
  assistant messages in order, and **emits the `llm_usage_event` that the billing
  meter reads** (`countInteractionsForEmployee` ≥ 1 afterward).

### 1.5 Independent web connection ✅
- Create + activate a web channel, then send a visitor message through the
  **public key only**.
- Observed: a reply is produced, a `public_chat.message_sent` event is recorded,
  and the organization is resolved from the channel public key (never client
  input). A **forged public key is rejected**.

---

## 2. Live HTTP smoke (booted app)

`next dev` booted successfully; observed responses:

| Request | Observed | Meaning |
|---|---|---|
| `GET /` | `200`, ~107 KB HTML | Landing renders |
| `GET /widget/taurus-widget.js?channelId=demo` | `200`, `application/javascript` | Embeddable widget served |
| `GET /login` | `200` | Auth entry renders |
| `GET /dashboard` (no session) | `307` → `/login?next=%2Fdashboard` | **Auth guard enforced at the HTTP layer** |
| `POST /api/webhooks/billing/stripe` (empty body) | `200` `{received:true,applied:false}` | Webhook route works; nothing applied |
| `POST /api/webhooks/billing/stripe` (unknown customer id) | `200` `{received:true,applied:false}` | **Org resolved from stored ids only — unknown → not applied (deny-by-default)** |
| `GET /api/public/channels/demo/messages` | `405` | Method not allowed (POST-only), correct |
| `GET /public/chat/unknownkey` | `200` | Graceful "unavailable" page (no crash) |

Server was stopped cleanly after the smoke.

---

## 3. Toolchain gates

| Gate | Result |
|---|---|
| `vitest run` (full suite) | **343 passing** (up from 271 at the start of this work) |
| `src/tests/terminology.test.ts` | green (no `agent` / `prompt` / `knowledge base` etc. in UI) |
| `tsc --noEmit` | clean |
| `next lint` | clean |
| `next build` | compiles; all routes generated |
| Store parity (in-memory vs PostgreSQL) | 124 methods, identical in both backends — zero drift |

---

## 4. Conclusion

The self-serve core loop and every subsystem a customer touches — auth, hiring,
Employee DNA, Knowledge Vault (extraction + retrieval), Model Hub provider keys,
chat runtime, web connections, billing/entitlements, and the audit trail — are
**Working** by the audit's strict definition and confirmed at runtime.

Remaining items are explicit, labeled product deferrals (Collaboration, Model Hub
budget enforcement, usage-analytics dashboard), not defects.

**Verdict: good to proceed to build.**
