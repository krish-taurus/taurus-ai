# Taurus AI — Full Functionality Audit

**Phase A (audit only).** No product code was changed to produce this report.
Method: every route under `src/app` was enumerated; every interactive element and
data view was traced component → handler/server-action/route → service → store,
and assigned a single status label. Findings were produced by five parallel
per-module traces and cross-checked against the source.

## Status legend

- **Working** — UI → action → service → store → persistence → reflected back,
  **with** a server-side permission check, organization scoping (org from
  session/publicKey, never client), input validation, and a handled
  error/empty/loading state.
- **Partial** — happy path works but missing one of: permission check, org
  scoping, validation, error/empty state, or persistence.
- **Static** — renders but the control does nothing real (dead handler, dead
  link, "coming soon", disabled with no enable path, hardcoded empty state).
- **Mock-only** — hardcoded/sample data where real data is expected.
- **Broken** — errors, 404s, or runtime failure.
- **Simulated (by design)** — an intentional fallback (dev auth, simulated
  billing/messaging/voice providers when keys are absent, in-memory rate limit,
  local-demo brain). **Not a defect.**

---

## Executive summary

The product is **substantially functional end-to-end**. The entire self-serve
core loop — **sign up → hire → configure Employee DNA → add knowledge → chat →
deploy to web** — is **Working** with real permission checks, organization
scoping, Zod validation, and error/empty/loading states at every step. Store
discipline is strong: **121 store methods, implemented identically in both the
in-memory and PostgreSQL backends — zero drift.** No dead `href="#"`, no empty
`onClick`/`onSubmit`, no `TODO`/`FIXME`/`throw "not implemented"`, and no
UI-referenced API route that doesn't exist were found anywhere.

The real gaps are concentrated in **adjacent trust/polish surfaces**, not the
core loop:

| # | Gap | Status | Impact |
|---|-----|--------|--------|
| 1 | ~~**Audit page** shows a hardcoded empty state; events are written at ~40 sites but there is no store read method and no `audit.view` check~~ → **FIXED in Batch 1** (now **Working**) | ✅ Working | Trust/compliance for SMB |
| 2 | **Employee detail** "Usage" / "Recent activity" tiles are hardcoded placeholders | Mock-only | Core-loop screen shows fake data |
| 3 | **Hire-success** "Knowledge / Test Chat / Voice" tiles are inert "Coming soon" — **yet those routes exist** | Static (stale) | Breaks the guided onboarding path |
| 4 | **Collaboration** page + module are an empty placeholder (nav links to it) | Static | Dead nav destination; product decision |
| 5 | Several `void` actions swallow errors (`catch {}` / dropped form state) — no user-facing failure feedback | Partial | UX; failures look like no-ops |
| 6 | **Voice** credential Save lacks Zod; credential **Test**/**Disable** named but never implemented | Partial / Static | Inconsistent with messaging; voice is foundation |
| 7 | **SendGrid / Telnyx / Vonage** webhook verification returns `true` on config-presence (no crypto check) | Security (foundation) | Must be real before those providers go live |
| 8 | "Collect visitor email" channel toggle is persisted but consumed by nothing | Static | Inert control |

Everything else labeled below as **Simulated (by design)** — dev auth, simulated
billing/messaging/voice providers, in-memory rate limiting, local-demo brain,
URL-stored-not-fetched knowledge, PDF/DOCX-stored-not-parsed — is intentional and
should **not** be "fixed" into a hard dependency.

---

## Surface inventory

**Pages (38):** landing `/`; auth `/login` `/signin` `/signup` `/forgot-password`
`/reset-password` `/onboarding`; dashboard `/dashboard` and `/dashboard/{employees,
employees/new, employees/[id], employees/[id]/edit, employees/[id]/dna,
employees/[id]/brain, employees/[id]/knowledge, employees/[id]/chat,
employees/[id]/channels, employees/[id]/channels/voice,
employees/[id]/channels/messaging/[type], hire, hire/success/[id], knowledge,
knowledge/new, knowledge/[id], knowledge/[id]/edit, connections, connections/new,
collaboration, audit, settings, settings/models, settings/models/catalog,
settings/models/configure, settings/models/providers, settings/billing,
settings/billing/plans}`; public `/public/chat/[publicKey]` `/embed/[publicKey]`.

**API / route handlers (7):** `/api/public/channels/[publicKey]/messages`,
`/api/webhooks/billing/stripe`, `/api/webhooks/channels/[provider]/[publicKey]`,
`/api/webhooks/voice/[provider]/[publicKey]`, `/auth/callback`,
`/dashboard/knowledge/[sourceId]/documents/[documentId]/download`,
`/widget/taurus-widget.js`.

**Shared security mechanism (verified correct):** HMAC-signed session
(`session.ts:75-110`, throws if `AUTH_SECRET` absent); org resolved from cookie
but **validated against real memberships** before use (`guards.ts:116-125`);
membership query scoped by org **and** user with active-status enforced
(`tenancy.ts:37-47`); least-privilege permission matrix with explicit grants
(`roles.ts:66-122`).

---

## Module reports

### auth — **Working** (dev auth Simulated-by-design)

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| `/login` `/signup` panel selection (Supabase vs dev vs none) | Working | `login/page.tsx:20-57` | Branches on `isSupabaseConfigured()`/`isDevAuthAvailable()` |
| `/signin` alias → `/login` | Working | `signin/page.tsx:8-19` | Forwards query params |
| OAuth Google / LinkedIn | Working | `oauth-buttons.tsx:45-65` | Per-provider pending + inline error |
| Email+password / OTP / magic-link sign-in | Working | `supabase-auth-panel.tsx:66-97` | loading/error; handles email-confirm case |
| Dev passwordless sign-in/up | Simulated (by design) | `dev-auth-panel.tsx:12-28`, `auth/actions.ts:36-85` | Zod-validated; `assertDevAuthAllowed()` blocks prod (`provider.ts:30-39`) |
| Forgot / reset password | Working | `forgot-password-form.tsx:21-46`, `reset-password-form.tsx:19-49` | No user enumeration; withheld without Supabase (by design) |
| Auth callback route | Working | `auth/callback/route.ts:23-65` | User id from verified `getUser()`, never client |

Summary: complete and secure; dev auth is the intentional no-Supabase fallback,
gated out of production. Minor: dev `signIn` hard-redirects to `/dashboard`
(`auth/actions.ts:84`) instead of `resolvePostAuthPath` — harmless (a no-org user
is bounced to `/onboarding` by the guard).

### organizations — **Working**

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Create-organization form | Working | `create-organization-form.tsx:23-37`, `organizations/actions.ts:41-62` | `requireUser` + Zod; creates owner + audit event; implicit Starter subscription |
| Org switcher | Working | `organization-switcher.tsx:15-46`, `organizations/actions.ts:64-77` | Re-validates membership server-side before honoring — never trusts client id |
| Sign out | Working | `sign-out-button.tsx:8-16`, `auth/actions.ts:87-100` | Clears Supabase + session + org cookies |

Summary: org creation, ownership, switching, and tenant validation are correct.

### employees — **Working** (two Mock/Static tiles)

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| List + cards, empty/loading/error | Working | `employees/page.tsx:10,43-45`; `loading.tsx`+`error.tsx` | Org-scoped `listEmployees` |
| Detail profile + section cards | Working | `[employeeId]/page.tsx:46-92` | Org-scoped `getEmployee`→`notFound()`; each section permission-gated |
| Detail **Usage / Recent activity** tiles | **Mock-only** | `[employeeId]/page.tsx:308-312` | Hardcoded "No activity recorded yet" — no data source |
| Edit form → `updateEmployeeAction` | Working | `edit-employee-form.tsx:33-36`; `employees/actions.ts:38-74`; `service.ts:98-135` | `employee.manage`, org-scoped, Zod, audit |
| Pause / Activate / Archive | Working (error swallowed) | `employee-actions.tsx:33-65`; `actions.ts:77-125` | Perm+org+audit; `catch {}` hides failures (`actions.ts:91,119`) |
| `/employees/new` | Working (by design) | `new/page.tsx:8-10` | Permanent redirect to `/dashboard/hire` |

Summary: all employee lifecycle mutations are permission-checked, org-scoped, and
audited; the only defects are the Mock-only activity tiles and swallowed action
errors.

### employee-dna — **Working**

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| DNA page guard + read + completion | Working | `dna/page.tsx:26-34,41,94-96`; `loading.tsx`/`not-found.tsx` | `employee.view`; org-scoped |
| Editor (7 sections) | Working | `dna-editor.tsx:75-338` | Client state via `update()` |
| Save Draft → `saveDnaDraftAction` | Working | `dna/actions.ts:47-76`; `service.ts:60-85` | `employee_dna.edit`, employee-in-org check, Zod `dnaSchemaV1`, `?saved=1` notice |
| Publish → `publishDnaAction` | Working | `dna/actions.ts:78-107`; `service.ts:91-124` | `employee.manage`; archives prior published |
| Version history + Archive | Working (error swallowed) | `dna-version-history.tsx:35-88`; `dna/actions.ts:109-128` | `employee.manage`+org; `catch {}` at `:122` |

Summary: draft/publish/version lifecycle is fully wired and secure.

### knowledge — **Working** (URL/file parsing Simulated-by-design)

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| List + stat cards + empty/loading | Working | `knowledge/page.tsx:11-14,39-41`; `service.ts:422-427` | `knowledge.view`; org-scoped overview |
| Add Text source | Working | `knowledge/actions.ts:45-67`; `service.ts:133-178` | `requireManage`→`knowledge.manage`; Zod; audit |
| Upload File source | Working | `actions.ts:93-123`; `service.ts:220-305` | File type/size/empty validation; stored before DB write |
| Add Website (URL) source | Simulated (by design) | `service.ts:181-217`; `create-knowledge-forms.tsx:177` | URL stored, never fetched (no SSRF); http/https-only Zod |
| Detail: badges, assigned employees, preview | Working | `[sourceId]/page.tsx:23-31,148-167` | Org-scoped; React-escaped text |
| PDF/DOCX "processing" | Simulated (by design) | `[sourceId]/page.tsx:137-140`; `service.ts:247,272` | Stored, not parsed |
| Document download route | Working | `.../download/route.ts:19-49` | `knowledge.view` (404 on deny), org scope + source-ownership + storageKey; `nosniff`, `attachment` |
| Edit / Archive source | Working (error swallowed) | `actions.ts:125-161`; `service.ts:309-340` | Zod; `archiveSourceAction` `catch {}` at `:155` |
| Assign / Unassign to employee | Working (error swallowed) | `actions.ts:163-195`; `service.ts:365-420` | Verifies **both** source and employee in org; `catch {}` at `:171,186` |

Summary: Knowledge Vault is fully wired and secure; deferred parsing/fetching is
intentional and labeled in the UI. Minor: three `void` actions swallow errors.
Note: `src/modules/knowledge/README.md:5` is **stale** ("No feature code yet").

### ai-runtime / model-hub — **Working** (model-hub); **Static** (ai-runtime module)

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Model Hub overview (stats, cost, provider status) | Working | `settings/models/page.tsx:15-107` | `model_hub.view`; org-scoped settings + overview |
| Model catalog table | Working | `model-catalog-table.tsx:29-83` | Code-authoritative catalog; scroll container |
| Configure: routing / default+fallback / allow-block | Working | `configure/page.tsx:9-12`; `org-model-settings-form.tsx`; `service.ts:51-111` | `model_hub.manage`; Zod; off-catalog rejected |
| Configure: monthly **budget** | Partial (by design) | `org-model-settings-form.tsx:164-195` | Saved/validated/persisted + audit, but **enforcement deferred** ("arrives in a later step") |
| Providers: BYOK save (encrypted) | Working | `provider-credentials.tsx:144-196`; `service.ts:164-229` | Zod; AES-256-GCM; only last-4 stored/shown; audit metadata-only |
| Providers: **Test connection** | Working (real network probe) | `service.ts:251-325` | Real `generateText` with `max_tokens:1`; safe message; audit |
| Providers: Remove/disable key | Working | `service.ts:328-345` | Perm re-check; slug validated; audit |
| Employee Brain (inherit/mode/advanced) | Working | `brain/page.tsx:16-97`; `model-gateway/actions.ts:78-100` | `model_hub.manage`; employee-in-org; Zod; live cost preview |
| `src/modules/ai-runtime/*` | Static (placeholder) | `ai-runtime/README.md:5` | README only; not referenced by UI. Runtime lives in `model-gateway/` |
| Gateway `generateText` | Working, not UI-wired | `gateway.ts:149-259` | Real provider adapters; reached via chat runtime |
| Local Demo Brain | Simulated (by design) | `gateway.ts:168-179`; `local-demo-brain.ts` | Only when no key **and** non-production |

Summary: Model Hub is fully functional and security-conscious (encryption,
last-4, real test probe). Budget is intentionally save-only for now. The
`ai-runtime` folder is a genuinely empty placeholder (naming only).

### chat runtime — **Working** (local-demo brain Simulated-by-design)

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Chat page guard + readiness gating | Working | `chat/page.tsx:17-29,120-129`; `readiness.ts:49-123` | `employee_chat.view`; server-computed block reasons |
| Send message → `sendChatMessageAction` | Working | `chat-conversation.tsx:117-168`; `employee-chat/actions.ts:38-80` | `employee_chat.use`+`employee.view`; org-scoped; Zod; interaction-quota gate; error/pending |
| Prepare/Refresh Knowledge | Working (error swallowed) | `prepare-knowledge-button.tsx:33-39`; `actions.ts:82-116` | Perm+org+audit; form error state discarded (`:33`) |
| Empty / "Thinking…" loading | Working | `chat-conversation.tsx:94-142` | |
| Local-demo brain label | Simulated (by design) | `chat/page.tsx:44-52`; `readiness.ts:89-94` | `local_demo` when no live provider in dev |

Summary: the chat turn is fully wired incl. permission, org scope, Zod, retrieval,
and the billing interaction-quota gate; only the prepare-knowledge error is not
surfaced.

### channels (web) — **Working** (one inert toggle)

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Web channel management page | Working | `channels/page.tsx:33-40` | `channel.view`; controls gated by `channel.manage` |
| Create web channel | Working | `create-channel-button.tsx:18-28`; `channels/actions.ts:39-62`; `service.ts:65-100` | `requireManage`; Zod; connection-entitlement gate |
| Activate / Pause / Revoke | Working | `channel-status-controls.tsx`; `actions.ts:100-141` | Org-scoped transitions; confirm on revoke |
| Settings (name/welcome/domains/appearance/rate-limit) | Working | `channel-settings-form.tsx`; `service.ts:103-129` | Zod `updateChannelSchema`; domain normalization |
| **"Collect visitor email" toggle** | **Static** | `channel-settings-form.tsx:122-129` | Labeled "coming soon"; persisted but no consumer |
| Install snippets + copy | Working | `install-snippets.tsx`; `copy-button.tsx:19-27` | Real URLs from `NEXT_PUBLIC_APP_URL`+publicKey |
| Public hosted chat / embed / widget | Working | `public/chat/[publicKey]/page.tsx`, `embed/[publicKey]/page.tsx`, `widget/.../route.ts` | Org resolved from publicKey only; no secret/PII leak |
| Public message API | Working (manual validation) | `api/public/channels/[publicKey]/messages/route.ts:60-124` | Org from publicKey; origin allowlist; **validation is manual type-guards, not Zod** (`:65-75`) |
| Public rate limiting | Simulated (by design) | `rate-limit.ts:25-58` | In-memory per-process; documented Redis swap |

Summary: the entire web deployment surface — management, hosted chat, iframe
embed, widget script, and the public message API — is Working with correct
publicKey-based org resolution and no client-trusted identity. Two nits: the
inert email toggle, and the public route uses manual (robust) validation instead
of Zod.

### channels (messaging) — **Working infra; provider go-live is Simulated-by-design**

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Messaging channel create / settings | Working | `create-messaging-channel-form.tsx`; `messaging/actions.ts:57-104`; `service.ts:78-144` | `messaging_channel.manage`/`requireManage`; Zod; entitlement gate |
| Status controls | Working | `messaging-status-controls.tsx:52-88`; `actions.ts:106-142` | Confirm on revoke; org-scoped |
| Provider credential save / disable | Working | `provider-credential-form.tsx:99-126`; `service.ts:191-257` | Encryption gate; required-field checks |
| Simulate incoming message | Simulated (by design) | `simulate-form.tsx`; `actions.ts:199-232`; `service.ts:269-304` | `channel.manage`; Zod; forces `mode:"simulated"` |
| Inbound webhook POST | Working | `webhooks/channels/.../route.ts:39-103`; `webhook.ts:36-130` | Org from publicKey; sig verify; contact-block/opt-out enforced |
| Signature verification | Working (Twilio/Meta/Mailgun); **Weak (SendGrid)** | `twilio.ts:82-98`, `meta-whatsapp.ts:94-102`, `mailgun-email.ts:77-86`; **`sendgrid-email.ts:84-85`** | SendGrid returns `verified:true` on apiKey presence — no crypto check |

Summary: full messaging infrastructure (channels, encrypted credentials,
webhooks, templates, opt-out) is built and org-scoped; live delivery is
foundation, exercised via the simulated test panel. **SendGrid signature
verification is not real** and must be fixed before SendGrid goes live.

### channels (voice) — **Working infra; foundation/Simulated-by-design; two Partials + two absent controls**

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Voice channel create + phone number | Working | `voice-runtime/actions.ts:81-98`; `service.ts:92-132` | `requireManage`; Zod; org from session |
| Voice channel update | Working | `actions.ts:100-115`; `service.ts:135-166` | Zod |
| Credential **save** | **Partial** | `actions.ts:148-169`; `service.ts:257-302` | Perm+org+encryption+error, but **no Zod** (manual cast) |
| Credential **test** / **disable** | **Static (absent)** | `voice-credential-form.tsx:35-107` | Named in scope but no button/action/service exists |
| Status controls (activate/pause/archive) | **Partial** | `voice-status-controls.tsx:50-52` | Perm+org OK, but **action error state dropped** (`const [, activate]`) |
| Simulate call (start/utterance/end) | Simulated (by design) | `actions.ts:173-262` | `channel.manage`; Zod; forces `mode:"simulated"` |
| Voice webhook POST | Working | `webhooks/voice/.../route.ts:21-85` | Org from publicKey; sig verify in live mode |
| Signature verification | Working (Twilio); **Weak (Telnyx/Vonage)** | `twilio-voice.ts:69-81`; **`telnyx-voice.ts:76-84`, `vonage-voice.ts:61-68`** | Telnyx/Vonage return `verified:true` on config-presence — no crypto check |

Summary: voice setup/credential/webhook infra is built and org-scoped; providers
are foundation (no live calls; media-stream start/stop are no-ops by design).
Real gaps vs. the messaging equivalent: voice credential Save lacks Zod, Status
controls drop error state, and credential Test/Disable are named but never
implemented.

### connections — **Working** (list/filter); **Partial by-design** (new-connection nav)

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Connections list + filters | Working | `connections/page.tsx:25-54`; `connections.ts:145-155` | `channel.view`; org-scoped; server re-validates filter values |
| Catalog cards → setup routes | Working | `connection-catalog.tsx:47-58` | Real `/connections/new?type=` links; coming-soon inert (by design) |
| New-connection page + form | Partial (by design) | `connections/new/page.tsx:16-20`; `new-connection-form.tsx:34-41` | `channel.manage` gate; **client-only nav** (`router.push`) to real per-employee setup route — no server action/Zod (intentional router) |
| Connection card **"Test"** link | **Partial (misleading)** | `connection-card.tsx:65-69` | Points to the Configure route, not a real test |

Summary: connections is a pure presentation/filter layer over channels
(no store ops of its own); it is Working. The "New connection" flow is a
deliberate navigator into the existing per-employee setup pages. The card "Test"
label is misleading — it does not invoke a test.

### audit — **Working** ✅ *(fixed in Batch 1)*

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Audit page | **Working** | `audit/page.tsx` | `requireCurrentOrganization` + `hasPermission("audit.view")` redirect; org-scoped `listAuditEvents`; friendly labels; actor-name resolution; empty + loading states |
| Store read path | **Working** | `store.ts` `listAuditEvents`; `in-memory-store.ts` + `postgres-store.ts` | Org-scoped, most-recent-first, identical in both backends |
| Friendly labels | **Working** | `modules/audit/metadata.ts` | Taurus terminology; humanized fallback for unknown codes |

Summary: **FIXED in Batch 1.** Audit events (written org-scoped at ~40 sites) are
now read via the new `store.listAuditEvents(orgId, limit)` (both backends) and
rendered on an owner/admin-only page with friendly labels, actor names, and
empty/loading states. Covered by `src/tests/audit.test.ts` (org scoping,
cross-org isolation, permissions, label mapping). No migration needed
(`audit_events` table already existed).

### usage — **Server-side metering only (no dedicated UI, by design)**

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Usage metering | Working (via billing) | `metadata.ts:35-44`; `in-memory-store.ts` `countBillableInteractionsSince` | Interaction counts derived from `llm_usage_events` |
| Dedicated usage dashboard | Static (placeholder) | `usage/README.md` | No UI/route; usage analytics is a later prompt |

Summary: usage events are emitted and are surfaced today only through the Billing
page's quota meters. A standalone usage/analytics dashboard is intentionally out
of scope for now.

### collaboration — **Static (placeholder feature)**

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Collaboration page | **Static** | `collaboration/page.tsx:3-16` | `PageHeader`+`EmptyState` only; no permission check, no data, no interactivity |
| Collaboration module | **Static** | `modules/collaboration/README.md` | "No feature code yet" — no service/actions/schema/store |

Summary: an empty placeholder that the sidebar links to. **Requires a product
decision:** build a minimal real feature, hide the nav entry, or leave it clearly
marked as forthcoming.

### settings — **Working** (member/org management is a deliberate placeholder)

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Settings page + Model Hub / Billing cards | Working | `settings/page.tsx:7-48` | Permission-gated links to real routes |
| Member / organization management | Static (by design) | `settings/page.tsx:50-54` | Explicit "arrives in a later step" EmptyState |

Summary: the settings hub routes correctly to Model Hub and Billing; member/org
management is a labeled forthcoming placeholder.

### dashboard shell — **Working**

| Element / View | Status | Evidence | Notes |
|---|---|---|---|
| Shell guard + org context + role badge | Working | `layout.tsx:23,66`; `guards.ts:107-126` | Redirects; org from validated membership |
| Sidebar nav (10 links) | Working | `dashboard-nav.tsx:19-30` | All hrefs resolve to real routes |
| Dashboard overview (stats, sections) | Working | `dashboard/page.tsx:11-33` | Real org-scoped data; permission-gated sections; empty states |
| Landing page + CTAs + `#pricing` anchor | Working | `page.tsx`; `final-cta.tsx:20` (`id="pricing"`) | Marketing-only by design; all CTAs and the Pricing anchor resolve |

Summary: shell, navigation, and the data-driven overview are fully Working.

---

## Consolidated failure-pattern findings

**Dead/static data views**
- ~~`audit/page.tsx` — constant empty state, no store read, no permission/org
  guard.~~ ✅ **FIXED in Batch 1** (now Working; `listAuditEvents` added to both backends).
- `[employeeId]/page.tsx:308-312` — hardcoded "Usage"/"Recent activity" tiles.
- `collaboration/page.tsx:3-16` — placeholder page; module is a lone README.

**Static / stale controls**
- `hire/success/[employeeId]/page.tsx:17-19,72-85` — "Knowledge / Test Chat /
  Voice" tiles rendered inert with "Coming soon" **though the routes exist**.
- `channel-settings-form.tsx:122-129` — "Collect visitor email" toggle persisted
  but consumed by nothing.
- `connection-card.tsx:65-69` — "Test" link navigates to Configure, not a test.
- Voice credential **Test**/**Disable** — named in scope, no implementation.

**Mutations with dropped/ swallowed error UI (Partial)**
- `employees/actions.ts:91,119` (pause/activate/archive), `employee-dna/actions.ts:122`
  (archive version), `knowledge/actions.ts:155,171,186` (archive/assign/unassign) —
  `catch {}` then redirect.
- `voice-status-controls.tsx:50-52` — dropped `useFormState` error slot.
- `prepare-knowledge-button.tsx:33` — discarded action state.

**Missing/inconsistent validation**
- `voice-runtime/actions.ts:148-169` — credential save has no Zod (manual cast).
- `api/public/channels/[publicKey]/messages/route.ts:65-75` — manual type-guard
  validation (robust) rather than Zod.

**Security (foundation providers — fix before go-live)**
- `sendgrid-email.ts:84-85`, `telnyx-voice.ts:76-84`, `vonage-voice.ts:61-68` —
  `verifyWebhook` returns `true` on config-presence, no cryptographic check.
  (Twilio, Meta, Mailgun, and Stripe do real HMAC verification.)

**Deferred by design (documented in UI — not defects)**
- URL sources stored-not-fetched; PDF/DOCX stored-not-parsed; Model Hub budget
  save-not-enforced; gateway not directly UI-wired; member/org management
  placeholder; usage dashboard out of scope.

**Not found (clean):** no `href="#"`, no empty `onClick`/`onSubmit`, no
`TODO`/`FIXME`/`throw "not implemented"`, no UI-referenced route that 404s, **no
mutation lacking a server-side role check, no query lacking org scoping.**

**Store parity:** all **121** `DataStore` methods are implemented in **both**
`in-memory-store.ts` and `postgres-store.ts` — **no drift.**

---

## Prioritized fix plan (batched)

Ranked by impact for a self-serve SMB launch. The **core loop is already
Working**, so priority goes to the highest-value real gaps that are safely
shippable. Each batch: files touched · risk · proof.

### Batch 1 — Make the **Audit trail** real ✅ **DONE**
Wired the emitted audit events to the page.
- **Files changed:** `src/lib/db/store.ts` (+`listAuditEvents(orgId, limit)`),
  `in-memory-store.ts` + `postgres-store.ts` (identical org-scoped, most-recent-first
  reads), `src/modules/audit/metadata.ts` (new — friendly Taurus labels + humanized
  fallback), `src/app/dashboard/audit/page.tsx` (rewritten: `audit.view` check +
  org-scoped read + actor-name resolution + empty state), `src/app/dashboard/audit/loading.tsx`
  (new), `src/modules/audit/README.md`, `src/tests/audit.test.ts` (new). **No migration**
  (`audit_events` table already existed).
- **Risk:** Low (additive read path; no mutation, no schema change). Preserved all
  Working behavior.
- **Proof:** `src/tests/audit.test.ts` — most-recent-first ordering + limit,
  cross-org isolation, `audit.view` owner/admin-only, label mapping + humanized
  fallback + no forbidden terminology. Full suite **305 passing**, terminology
  green, `tsc`/`lint`/`next build` clean; `/dashboard/audit` compiles.

### Batch 2 — **Onboarding path polish** *(core-loop UX, near-zero risk)*
- Convert `hire/success` "Coming soon" tiles into real links to the existing
  `/knowledge`, `/chat`, `/channels/voice` routes (they exist).
- Resolve the "Collect visitor email" toggle: hide it (recommended) or mark it
  clearly forthcoming, since nothing consumes it.
- **Files:** `hire/success/[employeeId]/page.tsx`, `channel-settings-form.tsx`.
- **Risk:** Very low (UI links/labels only; no store/permission change).
- **Proof:** links resolve; terminology test green; existing tests unchanged.

### Batch 3 — **Employee detail activity/usage tiles** → real data
Replace the hardcoded tiles with org-scoped reads.
- **Files:** `[employeeId]/page.tsx` reading real data via `listLlmUsageEvents`
  (already org-scoped) filtered to the employee, plus recent audit events for the
  employee (reuse Batch 1's `listAuditEvents`; add an employee filter if needed).
  Add an employee-scoped store read if required, in both backends.
- **Risk:** Low–Medium (depends on Batch 1; read-only).
- **Proof:** tile shows real counts/events; empty state when none; cross-org
  isolation test.

### Batch 4 — **Error-surfacing hardening**
Give failed mutations user-facing feedback.
- **Files:** `employees/actions.ts` (pause/activate/archive), `employee-dna/actions.ts`
  (archive version), `knowledge/actions.ts` (archive/assign/unassign),
  `voice-status-controls.tsx` + `voice-runtime/actions.ts`,
  `prepare-knowledge-button.tsx` — return/surface an error state instead of
  `catch {}` / dropped slots. Preserve current happy-path behavior.
- **Risk:** Low (adds feedback; does not change success flow or permissions).
- **Proof:** permission-denied and forced-failure cases render an error; happy
  path unchanged.

### Batch 5 — **Voice credential parity with messaging**
- Add Zod validation to voice credential save; implement voice credential
  **Test** and **Disable** mirroring the messaging pattern (`requireManage`,
  org scope, audit, encryption gate) — or, if out of scope for launch, remove the
  scope-named-but-absent controls and mark voice credentials Save-only in the UI.
- **Files:** `voice-runtime/actions.ts`, `voice-runtime/service.ts`,
  `voice-runtime/schema.ts`, `voice-credential-form.tsx`.
- **Risk:** Medium (new mutation surface; voice is foundation/simulated).
- **Proof:** save rejects invalid input; test/disable happy-path + permission-
  denied + cross-org tests; simulated mode still works with no keys.

### Batch 6 — **Real webhook signature verification (pre-go-live, security)**
For **SendGrid**, **Telnyx**, **Vonage**, replace config-presence checks with
real signature verification (mirroring Twilio/Meta/Mailgun/Stripe). Keep the
simulated/no-secret path intact for dev/tests.
- **Files:** `channels/messaging/providers/sendgrid-email.ts`,
  `voice-runtime/providers/telnyx-voice.ts`, `voice-runtime/providers/vonage-voice.ts`.
- **Risk:** Medium (security-sensitive; only matters when those providers go
  live — not launch-blocking while foundation/simulated).
- **Proof:** valid-signature accepted, tampered/invalid rejected (unit tests with
  known vectors); unsigned dev path still works.

### Product decisions (not auto-fix)
- **Collaboration:** build a minimal real feature, hide the nav entry, or keep it
  a clearly-labeled forthcoming placeholder. (Leaving a dead nav destination is
  the current state.)
- **Model Hub budget enforcement** and **usage/analytics dashboard**: intentionally
  deferred — confirm they remain out of this launch.
- **Connections "Test":** implement a real per-connection test, or relabel to
  avoid the misleading affordance.

### Trivial cleanup (fold into any batch)
- `src/modules/knowledge/README.md:5` is stale ("No feature code yet") — the
  module is fully implemented.

---

**Audit complete — awaiting go-ahead for Phase B.**
