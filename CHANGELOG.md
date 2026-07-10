# Changelog

## Sprint 046 - Object-storage (S3) adapter for uploads — 2026-07-10

Added:

- **Persistent upload storage** — Knowledge Vault uploads wrote only to local
  disk, which is ephemeral on serverless/containers (files vanish on redeploy).
  Uploads now persist to **Amazon S3** (or any S3-compatible endpoint: Cloudflare
  R2, MinIO, GCS S3-interop) when object storage is configured, and fall back to
  local disk when it isn't — no behavior change for local dev.
  - `S3KnowledgeStorage` (`src/modules/knowledge/storage-s3.ts`) implements the
    same `save`/`read` seam as local storage, with the **same key scheme**
    (`<orgId>/<opaque-key>`, optional prefix), so switching backends only moves
    bytes. **Dependency-free**: requests are signed with **AWS Signature V4**
    using `node:crypto` (no aws-sdk). Objects are private (never public-read) and
    served through the existing authenticated, org-scoped download route.
  - `getKnowledgeStorage()` selects S3 when `TAURUS_S3_BUCKET` + AWS credentials
    are present, else local. Wired into the upload action and the document
    download route. Supports virtual-hosted + path-style URLs, custom endpoints,
    key prefixes, and temporary (session-token) credentials.
  - Config via `TAURUS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
    `AWS_SECRET_ACCESS_KEY` (+ optional `AWS_SESSION_TOKEN`, `TAURUS_S3_ENDPOINT`,
    `TAURUS_S3_FORCE_PATH_STYLE`, `TAURUS_S3_PREFIX`) — documented in
    `.env.example` and the env schema.
  - Readiness updated: the `uploads_local_disk` warning now clears once object
    storage (or a persistent `TAURUS_UPLOAD_DIR`) is configured, and a new
    `uploads_s3_incomplete` warning fires when a bucket is set without AWS
    credentials (uploads silently fall back to local disk).
  - Tested: SigV4 signing-key derivation vs. an independent reference chain,
    deterministic + payload-sensitive signatures, virtual-hosted/path-style/custom
    endpoint URLs, session-token signing, PUT/GET request shape (mocked fetch,
    exact bytes, traversal rejection, error surfacing), the storage selector, and
    the two readiness warnings. `tsc` clean · `next lint` clean ·
    **595 tests + 6 skipped**.

## Sprint 045 - Real embeddings model for knowledge retrieval — 2026-07-10

Added:

- **Provider-backed embeddings** — knowledge retrieval used a deterministic local
  bag-of-words embedder even when a provider key was configured, capping semantic
  recall. It now embeds with **OpenAI `text-embedding-3-small` (1536-dim)** when a
  usable OpenAI credential resolves (a platform `OPENAI_API_KEY` or an org's own
  BYOK key), and falls back to the local embedder when no key is set — nothing
  hard-fails on setup.
  - `createOpenAiEmbedder` + `resolveEmbedder(store, orgId)`
    (`src/modules/knowledge/embedder-resolver.ts`) route through the SAME
    credential resolver as chat, so BYOK and managed keys both light it up with no
    extra config. Dependency-free `fetch`; reports input tokens + serving cost
    (0 under BYOK) so indexing records usage like any managed call. Wired at all
    three call sites (chat "Prepare knowledge", per-message query embedding, and
    the `backfill-embeddings` script).
  - **Migration 0027** widens the fixed `vector(256)` embedding column to a
    **dimensionless `vector`** so a model change (256 → 1536) can be re-embedded in
    place, and drops the fixed-dimension HNSW index. Retrieval only compares
    **same-dimension** vectors: the Postgres semantic search filters by
    `embedding_dim` inside a `MATERIALIZED` CTE so mismatched rows are excluded
    **before** any distance is computed — a re-embed that mixes dimensions never
    errors, and old-model rows are simply invisible to semantic search until
    re-embedded (lexical still grounds the answer).
  - New readiness **warning `embeddings_local_only`** — fires in production when
    `OPENAI_API_KEY` is unset, telling operators retrieval is on the local
    semantic-lite embedder and to re-prepare knowledge (or run the backfill) after
    setting the key.
  - Tested: OpenAI embedder (index ordering, token/cost accounting, BYOK = 0,
    empty-input short-circuit, error surfacing), resolver fallback vs. platform
    key, and the new readiness warning. `tsc` clean · `next lint` clean ·
    **583 tests + 6 skipped**.

## Sprint 044 - Production readiness check (fail loudly, not silently) — 2026-07-10

Added:

- **Go-live readiness check** — the app silently downgrades to
  simulated/local/in-memory modes when config is missing, so a misconfigured
  production deploy used to "boot fine" while losing data and serving no real AI.
  This adds a check that surfaces those gaps.
  - Pure `checkProductionReadiness(env)` (`src/lib/env/readiness.ts`) returns
    **blockers** (will break or lose data in prod — no `DATABASE_URL` → in-memory,
    weak/absent `AUTH_SECRET`, no auth provider, dev-auth enabled in prod, no AI
    model provider) and **warnings** (a feature is silently off — BYOK-only models,
    localhost app URL, local-disk uploads, missing channel master key, payment
    keys without their webhook secret). Non-production is all-clear.
  - **`npm run check:prod`** (`scripts/check-env.ts --force`) prints the report and
    **exits non-zero on any blocker** — run it as a deploy/predeploy step so a bad
    config fails the deploy instead of shipping. **`GET /api/health`** returns a
    terse status (`ok` / `degraded` / `blocked` / `dev`) + issue counts/titles for
    uptime monitors, and **503 when production has blockers** (no secret values are
    ever returned).
  - Fully unit tested (healthy env clean; empty prod env flags the four core
    blockers; dev-auth blocks; BYOK-only + webhook-secret + upload warnings; force
    mode). `tsc` clean · `next lint` clean · **576 tests + 6 skipped** · build compiles.

## Sprint 043 - Microsoft Teams channel (last connection) — 2026-07-09

Added:

- **Microsoft Teams** — the AI Employee now answers in Teams, completing the
  channel set from the Connections screen. Built on the Bot Framework: the Bot
  Connector POSTs an Activity to our messaging endpoint with a signed JWT; we
  **validate the token**, resolve the org from the Activity's **tenant id**, and
  reply through the Connector.
  - **Testable core, honestly scoped**: `teams/bot-framework.ts` — Activity
    parsing (strips `@mention` tags), **RS256 JWT verification against the
    connector JWKS** (audience + expiry + signature), a client-credentials
    connector token, and the reply `sendReply` — all **unit tested** (the JWT
    verifier is tested with a real generated RSA keypair + injected JWKS). A Teams
    `MessagingProvider` adapter replies via the serviceUrl stashed on the
    connection; the service (`processTeamsActivity`) owns tenant routing + JWT
    verification and reuses the shared messaging runtime.
  - New `microsoft_graph` provider registered, `getEmployeeChannelByTeamsTenant`
    on both stores (no migration; reuses `employee_channels` + `provider_config`),
    `POST /api/webhooks/teams`, a Teams setup page (enter the App ID + client
    secret + tenant → messaging endpoint), and a Workplace card. Teams now shows
    **available** in the catalog + Connections — **every channel from the
    Connections screen is now built**. New optional server-only `TEAMS_APP_ID` /
    `TEAMS_APP_PASSWORD`; without them Teams runs in simulated mode.
  - **Scope note**: going live needs an Azure app registration + AAD credentials +
    a sideloaded Teams manifest — that can only be exercised against real Azure, so
    the live handshake isn't test-covered; the parsing, JWT verification, token,
    reply and connect logic are. Verified on **live PostgreSQL** (tenant lookup) +
    unit tests. `tsc` clean · `next lint` clean · **567 tests + 6 skipped** ·
    build compiles.

## Sprint 042 - Facebook Messenger + Instagram DM channels — 2026-07-09

Added:

- **Facebook Messenger + Instagram DM** — the AI Employee now answers Messenger
  conversations and Instagram direct messages. Both ship together because they
  share the same Meta stack (Graph API + `X-Hub-Signature-256` webhook +
  `hub.challenge` GET handshake + `/me/messages` send).
  - **One shared adapter factory** (`providers/meta-messaging.ts`) serves both —
    only the webhook object name (`page` vs `instagram`) and channel identity
    differ. Parses `entry[].messaging[]` events, **ignores the page's own echoes**
    (loop guard) and delivery/read events, verifies the app-secret signature, and
    replies via the Graph API. Reuses the shared messaging runtime; runs in
    **simulated mode** without a Page token (dev/tests never hit the network).
  - New `meta_messenger` / `meta_instagram` provider types wired through the
    registry, webhook slugs (`…/channels/messenger|instagram/{publicKey}`), the
    generic messaging setup page (paste a Page access token → webhook URL →
    simulate → live), and the GET verification handshake (`META_WEBHOOK_VERIFY_TOKEN`).
    Both now show **available** in the catalog + Connections. New optional
    server-only `META_APP_SECRET` / `META_WEBHOOK_VERIFY_TOKEN`.
  - Verified by unit tests (Messenger + Instagram parsing, echo-ignore,
    `X-Hub-Signature-256` verification) and the updated catalog/connections
    assertions. `tsc` clean · `next lint` clean · **561 tests + 6 skipped** ·
    build compiles.

## Sprint 041 - WhatsApp: Embedded Signup one-tap connect — 2026-07-09

Added:

- **Connect WhatsApp with Meta's Embedded Signup** — the compliant, in-dashboard
  way to connect WhatsApp, instead of pasting access tokens + phone number ids.
  The owner authorizes their number in Meta's hosted popup; we exchange the
  returned code for a business token and finish the connection server-side.
  - **Testable backend, thin client**: `connect.ts` (code exchange, phone-number
    lookup, `connectWhatsApp` that stores the token/number/app-secret encrypted and
    creates/activates the connection) + an authenticated `POST
    /api/channels/whatsapp/exchange` — all **unit tested**. The client component
    loads Meta's SDK, runs the popup, and posts the result to that endpoint.
  - **Reuses the existing `meta_whatsapp_cloud` adapter** for send + webhook
    verification — no new runtime. New optional `NEXT_PUBLIC_WHATSAPP_APP_ID` /
    `NEXT_PUBLIC_WHATSAPP_CONFIG_ID` / `WHATSAPP_APP_SECRET`. Without them the
    one-tap connect is hidden and **manual credential entry still works**.
  - **Honest scope**: going live requires a **Meta Tech Provider app + business
    verification**, and the hosted popup itself can only be exercised against a
    real Meta app — so that path isn't covered by tests. The backend exchange +
    connect logic is fully unit tested (config gating, code exchange + error,
    number lookup with safe defaults, create/activate + reconnect-in-place). `tsc`
    clean · `next lint` clean · **558 tests + 6 skipped** · build compiles.

## Sprint 040 - Email: zero-DNS forwarding address — 2026-07-09

Added:

- **Zero-DNS email connect** — the easiest way to put an AI Employee on email.
  Each email connection now has a unique **forwarding address**
  `<publicKey>@<INBOUND_EMAIL_DOMAIN>`; the owner just **auto-forwards their
  support inbox** to it (no MX/DNS changes) and the AI replies to every message.
  - A single **domain-wide inbound webhook** (`…/channels/{provider}/inbound`)
    receives all mail for the domain (SendGrid Inbound Parse / a Mailgun Route)
    and resolves the connection from the **recipient address** — the public key is
    the local part. Unknown recipients are a clean 404, no leakage.
  - The email setup page shows the forwarding address with a copy button and
    plain-English instructions. Addressing logic is pure + unit tested; the
    domain-wide routing is covered end to end (right connection resolved, unknown
    recipient rejected). New optional server-only `INBOUND_EMAIL_DOMAIN`; without
    it, email keeps working via the existing per-connection webhook. `tsc` clean ·
    `next lint` clean · **553 tests + 6 skipped** · build compiles.

## Sprint 039 - Connections page: honest, actionable availability — 2026-07-09

Changed:

- **The Connections catalog now tells the truth.** After Telegram + Slack shipped,
  the catalog still lumped everything under jargon ("Foundation") — so channels
  that are actually live read as unclear. The three tiers are now accurate and
  business-readable:
  - **Available now** — Web, **Telegram**, **Slack** (live, self-serve one-tap /
    one-token connects). CTA: **Connect**.
  - **Ready to set up** — WhatsApp, SMS, Email, Phone (work end to end, but need
    the owner's provider account to go live). CTA: **Set up**, with a "needs a
    provider account — test in simulated mode first" hint.
  - **Coming soon** — Instagram, Messenger, Microsoft Teams.
  - Each configurable type still routes through the New-connection flow to its
    real setup page (`connectionSetupHref` covers Telegram → messaging/telegram
    and Slack → the OAuth connect page). Pure label/availability change — no
    provider logic. `tsc` clean · `next lint` clean · **551 tests + 6 skipped** ·
    build compiles.

## Sprint 038 - Slack channel ("Add to Slack" one-tap connect) — 2026-07-09

Added:

- **Slack connection** — the flagship true one-tap connect. The owner clicks
  **"Add to Slack"**, authorizes the app in their workspace (OAuth — no tokens to
  paste), and the AI Employee replies to messages and @-mentions in Slack.
  - **OAuth install** (`/api/channels/slack/install` → Slack consent →
    `/api/channels/slack/callback`) with an **HMAC-signed state** (AUTH_SECRET)
    bound to user + org + employee and a CSRF cookie. The per-workspace bot token
    is exchanged via `oauth.v2.access` and **stored encrypted** (never shown to the
    client).
  - **Events API** (`/api/webhooks/slack`): answers the `url_verification`
    handshake, **verifies the v0 request signature** (HMAC over
    `v0:{timestamp}:{body}`, with replay/skew protection), routes each event to the
    right workspace by **team id**, skips Slack **retries** so it never
    double-replies, and reuses the shared messaging runtime to answer via
    `chat.postMessage`.
  - Implemented as a `MessagingProvider` adapter (`slack/provider.ts`) — ignores
    other bots and message edits to avoid loops — plus an OAuth + events service.
    New `getEmployeeChannelBySlackTeam` on both stores (no migration; reuses
    `employee_channels` + `provider_config`). A **Workplace** section + Slack setup
    page surface the connect flow; Slack now shows **available** in the catalog and
    Connections. New optional server-only `SLACK_CLIENT_ID` /
    `SLACK_CLIENT_SECRET` / `SLACK_SIGNING_SECRET`; without them the connect is
    hidden and the channel runs in simulated mode.
  - Verified by unit tests (signed-state sign/verify + tamper, install URL,
    v0 signature valid/tampered/stale, event parsing incl. bot/edit ignores,
    url_verification challenge, team-id routing end to end, retry skip) and the
    live-PG team-id lookup. `tsc` clean · `next lint` clean · **551 tests + 6
    skipped** · build compiles.

## Sprint 037 - "Scan to chat" QR codes for channels — 2026-07-09

Added:

- **"Reach me" QR codes** — the safe, ToS-compliant flavor of "connect by QR": a
  code customers **scan to open a chat** with the AI Employee (not an auth code
  that links a private account). Shown on the channel setup pages with the link +
  copy button:
  - **Web** → the live hosted chat page (works once the web connection is active).
  - **Telegram** → `t.me/<username>`, **WhatsApp** → `wa.me/<number>`, **SMS** →
    `sms:<number>` (whenever the channel's username/number is configured).
  - QR is generated **server-side as inline SVG** (`qrcode`) from our own data —
    no external image request, renders under a strict CSP, and always dark-on-white
    so scanners stay reliable in either theme. Reach-link logic is pure + unit
    tested. `tsc` clean · `next lint` clean · **543 tests + 6 skipped** · build compiles.

## Sprint 036 - Telegram channel (first "coming soon" connection shipped) — 2026-07-09

Added:

- **Telegram connection** — the first of the "coming soon" channels made real. An
  owner creates a bot with **@BotFather**, pastes the **access token**, and the AI
  Employee answers Telegram messages end to end. Chosen first because it is the
  lowest-friction real channel (token + webhook, **no business verification**),
  per a review of how Intercom / Tidio / ManyChat / Botpress expose channels.
  - Implemented as a `MessagingProvider` adapter
    (`providers/telegram.ts`) that plugs into the existing messaging pipeline:
    parses Telegram **Update** JSON, verifies the optional
    `X-Telegram-Bot-Api-Secret-Token` (and treats the unguessable webhook URL as
    the shared secret when no secret is set), and replies via the Bot API
    `sendMessage`. No delivery receipts (Telegram doesn't send them).
  - Reuses the whole existing surface: the `messaging/telegram` setup page
    (create → credentials → webhook URL → **simulate** → go live), BYOK encrypted
    credential storage, webhook route `…/channels/telegram/{publicKey}`, and the
    Connections catalog. Telegram now shows as **available/foundation** instead of
    "coming soon"; runs in **simulated mode** with no token (dev/tests never call
    the network). New `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` env
    (optional, server-only).
  - Verified by unit tests (inbound Update parsing, non-text ignored, secret-token
    verification with/without a secret, live/simulated status) and an end-to-end
    JSON-webhook test through the runtime. `tsc` clean · `next lint` clean ·
    **539 tests + 6 skipped** · build compiles.

## Sprint 035 - Marketplace seller payouts (Connect / Route) — 2026-07-09

Added:

- **Seller payouts** — closes the money loop from Sprint 034. A seller **connects
  a payout account** (Stripe Connect / Razorpay Route — KYC handled by the
  provider via hosted onboarding) and **withdraws** their accrued revenue-share
  balance to it.
  - **Balance is derived, never stored**: `available(currency) = Σ paid
    seller_net − Σ (paid + pending) payouts`, per currency. An **Earnings** page
    shows the connect status, per-currency available balance, a **Withdraw**
    button, and payout history.
  - **Balance-and-withdraw** (not at-purchase split): a withdrawal records a
    payout row **first** (so a concurrent request can't double-spend), then moves
    the money. Simulated + successful live transfers settle immediately; failures
    are reconciled by webhook. Fulfillment is **idempotent**.
  - **Safe by default**: money only moves with live keys. With none, the
    simulated provider activates the account instantly and settles withdrawals
    in-process — **no network, no transfer**. Bank details never touch Taurus
    (they live with the provider); we store only the opaque connected-account id.
  - The three provider classes now implement a `MarketplacePayoutProvider`
    interface (`createConnectedAccount` / `createOnboardingLink` /
    `getAccountStatus` / `createTransfer` / `parsePayoutWebhookEvent`) —
    Stripe via **Connect Express transfers**, Razorpay via **Route**. Account +
    payout webhooks share `POST /api/webhooks/marketplace/{provider}` (payment
    events first, then account/payout events).
  - New `0026_marketplace_payouts.sql` (`marketplace_payout_accounts` +
    `marketplace_payouts`, each with the right unique/partial indexes), store
    methods on both backends, and `startPayoutOnboarding` / `getSellerBalances` /
    `requestPayout` / `fulfillPayoutWebhook` service functions (pure; the provider
    is injected at the action layer).
  - Verified end-to-end on a **live PostgreSQL** (0026 applies; onboarding →
    withdraw drains the $85 net balance, records the payout with its transfer id,
    and refuses a second empty withdrawal) and by unit tests (balance math,
    simulated + redirect onboarding, withdraw idempotency + insufficient balance,
    account.updated + payout.failed webhooks). `tsc` clean · `next lint` clean ·
    **534 tests + 6 skipped** · build compiles.

## Sprint 034 - Marketplace paid lease / revenue-share (Stripe + Razorpay) — 2026-07-09

Added:

- **Paid AI Employees with revenue-share** — a seller can put a **one-time hire
  price** on a listing. A priced listing becomes **buy-now**: the buyer pays
  through a hosted checkout and, on a **verified `paid` webhook**, the hire is
  auto-created and the DNA is cloned into their org. **Free listings are
  unchanged** (request → approve).
  - **Two payment providers + safe default**: **Stripe** (Checkout, one-time
    `payment` mode) and **Razorpay** (Payment Links), behind a
    `MarketplacePaymentProvider` adapter (mirrors the billing-provider pattern).
    With **no keys configured, a Simulated provider** completes the purchase
    in-process — local dev and tests **never touch the network and never charge**.
    Card data never touches Taurus (hosted checkout); webhook signatures are
    verified (Stripe + Razorpay HMAC); fulfillment is **idempotent** (a replayed
    webhook never creates a second clone).
  - **Revenue-share ledger**: every payment records `platform_fee` + `seller_net`
    in minor units (fee = `MARKETPLACE_PLATFORM_FEE_BPS`, default **1500 = 15%**,
    floored so the seller is never short-changed). A seller **Earnings** view and
    a buyer **Purchases** view surface the ledger. **Payouts/disbursement** to
    sellers (Stripe Connect / Razorpay Route, which need seller KYC onboarding)
    are a **documented follow-up** — v1 records what is owed and never auto-moves
    money to a third party.
  - **Security unchanged**: only the **DNA** is ever sold — the knowledge vault is
    **never shared** (a purchased clone starts with zero vaults; unit- and
    Postgres-verified). The webhook resolves the payment from **our own opaque
    reference**, never trusting the body for identity.
  - New `0025_marketplace_payments.sql` (price columns on `marketplace_listings`
    + `marketplace_payments` table with a unique reference and a partial unique
    `(provider, external_payment_id)` index), store methods on both backends,
    `POST /api/webhooks/marketplace/{provider}`, and `RAZORPAY_*` /
    `MARKETPLACE_PLATFORM_FEE_BPS` env (all server-only).
  - Verified end-to-end on a **live PostgreSQL** (0025 applies; the priced
    purchase → webhook-settlement flow clones the DNA, records the 15% split, and
    is idempotent on replay) and by unit tests (split math, pricing helpers,
    simulated purchase → clone, redirect + webhook settlement, failed/unknown
    events, provider parsing + signature verification). `tsc` clean · `next lint`
    clean · **526 tests + 5 skipped** · build compiles.

## Sprint 033 - Public shareable resume links — 2026-07-09

Added:

- **Public shareable resume links** — a published listing now has an
  **unauthenticated** resume page at `/marketplace/{publicKey}` that anyone can
  open without a Taurus account. Owners get a **"Copy link"** affordance on their
  listing (shown only while published) to share an AI Employee's resume anywhere.
  - **Same security boundary as the marketplace**: the page resolves the listing
    **from the opaque public key only** (`getPublicResumeByKey`, published-only)
    and renders **only the snapshot** — DNA with `companyContext` blanked, the
    performance summary, vault **descriptions** only, and the star reviews. No
    live tenant data, no hire controls; the CTA is "Sign in to hire". Unpublishing
    a listing immediately dead-links its shared URL.
  - The route sits outside the auth middleware matcher (like the public chat /
    embed surfaces), reuses the pure `ResumeView` / `RatingSummary` components,
    and adds no schema change (it uses the existing `marketplace_listings.public_key`).
  - Verified by a unit test (published resolves by key; bogus key and unpublished
    both return null; the seller's private narrative never appears in the shared
    snapshot). `tsc` clean · `next lint` clean · **515 tests + 5 skipped** · build compiles.

## Sprint 032 - Marketplace ratings & reviews — 2026-07-09

Added:

- **Ratings & reviews on the marketplace** — an organization that has actually
  **hired** a listed AI Employee (an approved hire) can leave a **1–5 star rating
  + review** on its resume. The directory cards and the resume header show the
  average rating and review count.
  - **Credible by design**: reviewing requires an **approved hire** for that
    listing (enforced in the service) and you can't review your own listing; one
    review per organization per listing (upsert — editable). Rating is validated
    1–5, comment capped.
  - New `marketplace_reviews` table + denormalized `rating_count` / `rating_avg`
    on `marketplace_listings` (`db/migrations/0024_marketplace_reviews.sql`,
    recomputed from the full review set whenever a review is written).
  - New store methods (both backends), `submitReview` / `canReviewListing` /
    `listListingReviews` service + a `submitReviewAction`, a star display +
    review form, wired into the resume page and directory cards.
  - Verified end-to-end on a live PostgreSQL (`0024` applies; one-review-per-org
    upsert updates in place; the 1–5 CHECK rejects out-of-range) and by unit tests
    (hire-gated reviewing, aggregate recompute, own-listing + range rejection).

## Sprint 031 - Inter-company marketplace (2/2): AI-written resumes — 2026-07-09

Added:

- **AI-generated marketplace copy** — on the publish form, **"✨ Generate with AI"**
  writes a world-class resume **headline + summary** for an AI Employee, grounded
  only in its published DNA (role/mission/goals/responsibilities). Publishing
  "with vaults" can also **auto-describe** any vault that has no description yet.
  - Generation runs through the model gateway
    (`src/modules/marketplace/generation.ts`, task types `dna_summary` /
    `knowledge_summary`). The prompt is constrained to **general best-practice
    guidance only** — it never invents metrics, clients, or proprietary data. In
    dev/test (no provider key) it uses the demo brain; in production without a key
    it fails **gracefully** ("fill it in manually"), and vault auto-description is
    best-effort (never blocks publishing).
  - Wiring keeps the service pure: `publishListing` takes an optional
    `describeVault` hook the publish action supplies (gateway-backed); unit tests
    inject a stub. No schema change.
  - Verified: the generation path runs end-to-end via the demo brain (returns
    usable copy; requires published DNA; vault description is string-or-null).
    `tsc` clean · `next lint` clean · **512 tests + 5 skipped** · build compiles.

## Sprint 030 - Inter-company marketplace (1/2): publish, discover, hire — 2026-07-09

Added:

- **AI Employee marketplace** — an organization can publish an employee as a
  public **resume** (its DNA + a performance summary, and optionally descriptions
  of the vaults it uses). Other organizations browse a network-wide directory and
  **hire** it, which **clones the DNA** into the hirer's org as a new employee.
  - **Security by construction**: a listing is a self-contained **snapshot** taken
    at publish time — the public marketplace reads only the listing row, never the
    seller's live private tables. The DNA snapshot's org-specific `companyContext`
    is **blanked**, and **only the DNA is ever cloned — the knowledge vault is never
    shared** (a hired agent starts with no vaults; the hirer attaches their own).
    Publishing "with vaults" includes vault **names/descriptions only**, never content.
  - **Flow**: publish from an employee (requires published DNA) → appears in the
    **Marketplace** directory → another org opens the resume and **Requests to
    hire** → the owner **approves** in a requests inbox → the DNA is cloned into the
    hirer's org. Owners can unpublish/re-publish (refresh the snapshot).
  - New tables `marketplace_listings` + `marketplace_hires`
    (`db/migrations/0023_marketplace.sql`, one listing per employee). New
    `src/modules/marketplace/` service + actions, store methods (both backends),
    a "Marketplace" nav entry, and pages: directory, resume, my-listings, requests,
    and a publish page under each employee.
  - Verified end-to-end against a live PostgreSQL (`0001→0023` applies cleanly;
    cross-org published-listing visibility, the hire inbox, and one-listing-per-
    employee all enforced) and by unit tests covering publish, cross-org discovery,
    the hire→clone path, the **vault-never-shared** guarantee, owner-only approval,
    and unpublish. AI-generated resume descriptions land in part 2.

## Sprint 029 - Assign whole vaults to employees — 2026-07-09

Added:

- **One-click vault assignment** — give an AI Employee a whole **vault** and it can
  use every source in it, and anything added to that vault later flows through
  automatically. This replaces per-source assignment as the live relationship.
  - New `employee_knowledge_vaults` table
    (`db/migrations/0022_employee_knowledge_vaults.sql`). The migration backfills
    existing per-source assignments into vault assignments (an employee who had any
    source from a vault is granted that whole vault), so no one loses access; the
    old `employee_knowledge_sources` table is left in place (non-destructive).
  - **Retrieval now resolves through vaults**: an employee sees a knowledge segment
    only if the source's vault is assigned to them (both lexical and semantic paths,
    both stores). `listKnowledgeSourcesForEmployee`, `listEmployeesForKnowledgeSource`,
    the assigned-count, and the vault overview all resolve via vaults.
  - Store: `assignVaultToEmployee` / `unassignVaultFromEmployee` /
    `listVaultsForEmployee` / `listEmployeesForVault`. Service + actions:
    `assignVaultToEmployee` / `unassignVaultFromEmployee` (org-scoped, audited).
  - UI: the employee's knowledge page now lists **vaults** with per-vault source
    counts and an Assign/Remove toggle; the header shows how many vaults and total
    sources the employee can use.
  - Verified end-to-end against a live PostgreSQL: `0001→0022` applies cleanly, the
    vault-scoped retrieval join grants access only when the vault is assigned (and
    revokes on unassign), and the backfill maps legacy per-source assignments to the
    correct vault. Retrieval/chat unit tests updated to assign vaults.

## Sprint 028 - Multiple Knowledge Vaults (organizing layer) — 2026-07-09

Added:

- **Multiple Knowledge Vaults** — a vault is a named collection (folder) of
  knowledge sources within an organization, so knowledge can be categorized and
  found easily. Every source belongs to exactly one vault.
  - New `knowledge_vaults` table + a `vault_id` on `knowledge_sources`
    (`db/migrations/0021_knowledge_vaults.sql`). The migration backfills a per-org
    default **"General"** vault and files all existing sources into it, so current
    data is unchanged. A partial unique index enforces one default vault per org;
    `vault_id` uses `on delete restrict` so sources are never orphaned.
  - Store methods (both backends): create/list/get/update/delete vaults, the
    default vault, and per-vault source-count summaries; `createKnowledgeSource`
    files into a vault; `updateKnowledgeSource` can move a source between vaults.
  - Service: vault CRUD (`createKnowledgeVault`, `renameKnowledgeVault`,
    `deleteKnowledgeVault` — which reassigns the vault's sources to the default and
    refuses to delete the default), `ensureDefaultVault`, and vault resolution in
    every Add-Knowledge flow (defaults to "General" when none is chosen; a vault
    from another org is rejected).
  - UI: the Knowledge list is now **grouped by vault** with per-vault counts and
    create / rename / delete controls; the Add Knowledge form has an **"Add to
    vault"** picker (all source types, incl. the OAuth connectors); the edit form
    can **move** a source to another vault.
  - Verified end-to-end against a live PostgreSQL: the full 0001→0021 migration
    chain applies cleanly and the backfill files existing sources into a new
    default vault with no orphans. (Assigning a whole vault to an AI Employee is
    the next change; retrieval is unchanged in this one.)

## Sprint 027 - Data connectors (SharePoint / OneDrive) — 2026-07-09

Added:

- **SharePoint / OneDrive knowledge connector** (`src/modules/knowledge/connectors/sharepoint.ts`)
  — connect a Microsoft account (read-only) and import a OneDrive or SharePoint
  **file or folder from a sharing link**; each file's text becomes a searchable
  Knowledge Vault document. A **"Sync now"** action re-reads and refreshes.
  - **Microsoft OAuth 2.0** with two route handlers — `start` (signed, user/org-bound
    `state` + CSRF cookie → Microsoft consent) and `callback` (verify state, exchange
    code, stash the account in an encrypted httpOnly cookie for the Add Knowledge
    form). Delegated scopes are read-only: `Files.Read.All` + `Sites.Read.All`
    (+ `offline_access`, `User.Read`).
  - A single **sharing link** covers both OneDrive and SharePoint — Microsoft Graph's
    `/shares/{id}/driveItem` resolves it to a drive item, then we read the file (or
    list a folder one level deep, ≤ 50 files) via the drive and reuse the existing
    extraction → index → hybrid-retrieval pipeline.
  - **Secrets protected**: the refresh token is AES-GCM encrypted at rest and never
    sent to the browser; only the connected account email is shown.
  - New `sharepoint` source type + a "SharePoint / OneDrive" tab in Add Knowledge
    (the OAuth connect tab is now shared with Google Drive). Setup guide:
    `docs/connectors/sharepoint.md` + `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`
    (optional `MICROSOFT_TENANT`, `MICROSOFT_REDIRECT_URI`). Absent config hides the
    connector. Dependency-free (REST over `fetch` + `node:crypto`).

## Sprint 026 - Data connectors (Cloud storage: Amazon S3) — 2026-07-09

Added:

- **Amazon S3 support in the cloud storage connector**
  (`src/modules/knowledge/connectors/cloud-storage.ts`). The "Cloud Storage" flow
  now offers **Azure Blob / Google Cloud Storage / Amazon S3** — pick S3, enter a
  bucket + region + a least-privilege **read-only access key** (optional session
  token), and the objects become searchable Knowledge Vault documents. "Sync now"
  re-reads the bucket.
  - **AWS Signature V4** request signing implemented with `node:crypto` (no AWS
    SDK dependency) — ListObjectsV2 + GetObject. Verified against **AWS's published
    SigV4 test vector**.
  - Same safety model as the other providers: read-only (only `s3:ListBucket` +
    `s3:GetObject` needed), bounded (≤ 50 files, optional prefix, 10 MB/file cap,
    supported types only), and the access key is stored **encrypted at rest**
    (only bucket + region are shown). Standard AWS S3 endpoints only.
  - Setup steps + IAM policy in `docs/connectors/cloud-storage.md`. No new env vars.

## Sprint 025 - Data connectors (Cloud storage: Azure Blob + GCS) — 2026-07-09

Added:

- **Cloud storage knowledge connector** (`src/modules/knowledge/connectors/cloud-storage.ts`)
  — connect an object store and import its files into the Knowledge Vault. Two
  providers, both read-only and configured entirely in the app:
  - **Azure Blob Storage** via a read/list **container SAS URL** (fetches pinned to
    `*.blob.core.windows.net`; the SAS is customer-scoped + time-boxed).
  - **Google Cloud Storage** via a **service-account JSON key** — the connector
    mints a short-lived access token itself (RS256 JWT signed with `node:crypto`,
    `devstorage.read_only` scope), no SDK dependency.
  - **Bounded + safe**: up to 50 files (optional path prefix), 10 MB/file cap,
    only extractor-supported types (PDF/Word/text/CSV/JSON) are pulled — the rest
    are skipped. Files run through the existing extraction → index →
    hybrid-retrieval pipeline. The credential is **encrypted at rest** and never
    sent to the browser; only the account/container or bucket name is shown.
  - New `cloud_storage` knowledge source type + a "Cloud Storage" tab (provider
    picker) in Add Knowledge, and **"Sync now"** to re-read the bucket/container.
  - Dependency-free (REST over `fetch` + `node:crypto`). Setup guide:
    `docs/connectors/cloud-storage.md`. No new env vars — uses the existing
    `TAURUS_MODEL_CREDENTIALS_MASTER_KEY` for encryption.

## Sprint 024 - Data connectors (MySQL) — 2026-07-09

Added:

- **MySQL support in the database connector** (`src/modules/knowledge/connectors/database.ts`).
  The "Connect Database" flow now offers **PostgreSQL or MySQL** — pick the engine,
  paste a `mysql://…` (or `postgres://…`) connection string and a read-only
  `SELECT`, and the rows become searchable Knowledge Vault documents. "Sync now"
  works the same for both.
  - **Same safety model**: single validated read-only statement, executed inside a
    `START TRANSACTION READ ONLY` with a per-statement timeout (`max_execution_time`)
    so MySQL itself rejects any write; the `mysql2` driver runs with
    `multipleStatements` off (no stacked SQL); SSRF host guard, capped rows/text,
    and the connection string stored encrypted (only the host is shown).
  - `executeMysqlReadOnlyQuery` (dynamic `mysql2/promise` import so the Postgres
    path never loads the MySQL driver, and vice versa). The Add Knowledge form gains
    a database-engine selector; the schema validates the scheme against the engine.
  - Verified end-to-end against a live MariaDB (read → text, and a read-only
    transaction rejecting a write). `pg` + `mysql2` added to
    `serverComponentsExternalPackages`.

## Sprint 023 - Data connectors (Google Drive) — 2026-07-08

Added:

- **Google Drive knowledge connector** (`src/modules/knowledge/connectors/google-drive.ts`)
  — connect a Google account (read-only) and import a Drive **file or folder**;
  each file's text becomes a searchable Knowledge Vault document an AI Employee can
  answer from. A **"Sync now"** action re-reads Drive and refreshes the documents.
  - **OAuth 2.0** flow with two route handlers — `start` (builds a signed,
    user/org-bound `state` + CSRF cookie and redirects to Google) and `callback`
    (verifies state, exchanges the code, stashes the account for the Add Knowledge
    form). Scope is `drive.readonly` only — the app can never modify a user's Drive.
  - **Secrets protected**: the refresh token is AES-GCM **encrypted at rest** (same
    key store as model credentials) and never sent to the browser; only the
    connected account email is shown. The short-lived connect handoff uses an
    encrypted, httpOnly cookie.
  - **Bounded ingestion**: a folder is read one level deep (up to 50 files),
    oversized files are skipped, and Google-native Docs/Sheets/Slides are exported
    (Doc→DOCX, Sheet→CSV, Slides→text) then run through the existing extraction →
    index → hybrid-retrieval pipeline. New `google_drive` knowledge source type +
    a "Google Drive" tab in Add Knowledge.
  - Setup: `docs/connectors/google-drive.md` (Google Cloud OAuth app) +
    `GOOGLE_DRIVE_CLIENT_ID` / `GOOGLE_DRIVE_CLIENT_SECRET` (optional
    `GOOGLE_DRIVE_REDIRECT_URI`). Absent config hides the connector; other sources
    are unaffected.

## Sprint 022 - Data connectors (Database) — 2026-07-08

Added:

- **Database knowledge connector** (`src/modules/knowledge/connectors/database.ts`)
  — the first data-source connector. Connect a **PostgreSQL** database with a
  read-only SELECT and its rows become searchable Knowledge Vault documents an AI
  Employee can answer from (a product catalog, an FAQ table, a policy table). A
  **"Sync now"** action re-runs the query and replaces the stored rows.
  - **Safe by construction**: the query must be a single read-only statement
    (validated, comment-stripped) AND runs inside a `READ ONLY` transaction with a
    statement timeout, so the database itself rejects any write. The host must
    resolve to a public IP (SSRF-guarded), rows/text are capped, and the
    connection string is stored **encrypted** (only the host is ever shown).
    Callers should still use a least-privilege read-only DB user.
  - Reuses the existing extraction → index → hybrid-retrieval pipeline; a new
    `database` knowledge source type + a "Connect Database" tab in Add Knowledge.
  - New store method `deleteKnowledgeDocumentsForSource` (both stores) powers
    re-sync. MySQL and cloud-storage/SharePoint connectors follow the same shape.

## Sprint 021 - Knowledge ingestion + app polish — 2026-07-08

Added:

- **Real Knowledge Vault ingestion** (`src/modules/knowledge/extraction.ts`).
  Previously PDFs/DOCX were stored without their text and website URLs were never
  fetched, so AI Employees had nothing to ground on. Now:
  - **PDF** text is extracted (`pdf-parse`) and **DOCX** via `mammoth`; text
    formats (txt/md/csv/json) decode as before. A file whose text can't be read
    (e.g. a scanned PDF) is still saved but flagged for attention.
  - **Websites are fetched** and reduced to readable text, **SSRF-guarded** —
    http/https only, and every hop must resolve to a public IP (localhost,
    private ranges, and cloud-metadata endpoints are blocked), with time/size
    caps. The page text is stored as a searchable document.
  - Extraction runs in the server action; the service stays pure/testable.
  Extracted content flows into the existing prepare/index → hybrid retrieval, so
  Employees can finally answer from uploaded documents and saved websites.
- **App polish** — the whole dashboard now uses the light (white/black/grey)
  theme, grouped icon-based navigation (sidebar + a new mobile menu), a Model Hub
  sub-nav, standardized back links, and a BYOK upgrade call-to-action.

## Sprint 020 - Onboarding Polish + Landing Page — 2026-07-08

Added:

- **First-run activation checklist** (`src/modules/onboarding/`) — a dismissible,
  resumable checklist on the dashboard overview that guides a new organization to
  its first live AI Employee: hire, give DNA, add a Knowledge Vault source
  (optional), test in chat, and deploy the web widget. Step completion is
  **derived entirely from real data** (hired Employees, published DNA, Vault
  sources, chat threads, active website channels) — no parallel per-step flags.
  The only persisted state is per-org dismissal + the completion milestone
  (`organization_onboarding`, migration `0019_onboarding.sql`, org-scoped in both
  stores). Role-respecting: a viewer sees progress but no owner/admin-only CTAs.
  Dismiss/resume are audited; the completion milestone emits a one-time
  `onboarding.completed` audit event.
- **Test-in-chat moment** — the hire success page now leads with a primary
  "Test {name} in chat" action that drops the user straight into a live
  conversation, then points them at deploying across channels.
- **Better empty states** — the Performance overview now uses the shared
  `EmptyState` primitive (role-aware copy) instead of a bare line of text.
- **New landing page** (`src/app/page.tsx`, `src/components/landing/light/`) —
  ported to a bright, editorial theme: **white background, near-black ink, dark
  accents to highlight**, oversized type, crisp inline-SVG imagery, and
  scroll-revealed sections. Sections: hero ("Hire AI employees. Not another
  chatbot." with a word-by-word rise-in), the "a quarter → an afternoon"
  positioning, the four-step Hiring Studio, a **step-by-step use-cases
  walkthrough** across five domains (problem → solution → illustrative stat, with
  an honest "illustrative scenarios" disclosure and no fabricated customers),
  Channels (web / WhatsApp + SMS / phone), an animated Performance Review
  scorecard, the Model Hub "any model, no lock-in" band, pricing read from the
  code-authoritative plans catalog (no hard-coded prices), and the final CTA. All
  motion respects `prefers-reduced-motion`; CTAs route to the real `/signup` and
  `/login`. The previous dark landing components were removed.

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
