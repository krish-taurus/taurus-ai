# Taurus AI Phase 0 Execution Pack v1

Date: 2026-07-06

## What Taurus AI is

Taurus AI is an **agentic employee ecosystem** for enterprises.

The product promise:

> Hire and collaborate with AI employees in five minutes.

The long-term vision:

> Become the biggest ecosystem, marketplace, and job board for AI employees.

## What this pack contains

This pack contains the first build-ready specification and Claude prompt set for Taurus AI.

It is designed so you can create a GitHub repository and start giving Claude / Cursor / another coding assistant one implementation task at a time.

## Core decision

Taurus AI starts as the **world's easiest enterprise AI employee platform**.

Not the most complicated.
Not the most technical.
Not another chatbot.

The first wedge is simplicity:

> A non-technical enterprise user should feel they automated work with a few clicks.

## Recommended MVP stack

To keep cost and complexity under control, start with a modular monolith:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- PostgreSQL
- pgvector-ready schema
- Supabase Auth or Clerk
- S3-compatible object storage or Supabase Storage
- provider-agnostic AI adapter
- background worker later
- voice capability stubbed in Phase 1 and implemented in Phase 2

## How to start immediately

1. Create a private GitHub repository named `taurus-ai`.
2. Open Claude / Cursor.
3. Paste the full contents of `START_HERE_FOR_CLAUDE.md`.
4. Tell Claude to complete **Prompt 001 only**.
5. Do not allow Claude to build future phases yet.

## Execution rule

Claude is not the architect.

Claude is Engineer #1.

The founder and CTO layer decide the product, architecture, scope, terminology, security model, and roadmap.
Claude implements one bounded task at a time.

## Current prompt sequence

1. Repo Foundation
2. Database, Auth, and Tenancy
3. AI Employee CRUD and Employee Card
4. Hiring Studio
5. Employee DNA
6. Knowledge Vault
7. RAG Chat Runtime
8. Internal Employee Collaboration
9. Audit and Usage
10. Voice Provisioning Stub

## MVP definition

The MVP is complete when an enterprise user can:

- sign up,
- create an organization,
- hire an AI employee,
- configure Employee DNA without writing prompts,
- upload company knowledge,
- chat with the AI employee,
- create an internal collaboration request between employees,
- see audit events,
- see usage metrics.

No public marketplace yet.
No full cross-company autonomous network yet.
No production voice calling yet.

Those are later phases.

---

# Application Setup (Prompt 001: Repo Foundation)

This repository now contains the Taurus AI application foundation: a modular
monolith built with Next.js (App Router), TypeScript, and Tailwind CSS. This is
the deliverable for **Prompt 001 only** — placeholder pages, navigation, and the
core folder structure. No product features are implemented yet.

## Prerequisites

- Node.js 18.18+ (developed on Node 24)
- npm 9+

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.example .env.local
# (Windows PowerShell: Copy-Item .env.example .env.local)

# 3. Start the dev server
npm run dev
```

Then open http://localhost:3000.

The app runs without a database or provider keys in Prompt 001 — all environment
variables in `.env.example` are optional placeholders for now.

## Available scripts

| Command                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Start the local development server                 |
| `npm run build`        | Production build (also type-checks the app)        |
| `npm run start`        | Run the production build                           |
| `npm run lint`         | Lint with ESLint (`next/core-web-vitals`)          |
| `npm run format`       | Format the codebase with Prettier                  |
| `npm run format:check` | Check formatting without writing                   |
| `npm run typecheck`    | Type-check with `tsc --noEmit`                     |
| `npm test`             | Run the Vitest test suite                          |

## Project structure

```text
src/
  app/          Next.js App Router pages (landing, auth, dashboard)
  components/   Shared UI (navigation shell, page header)
  modules/      Feature modules (placeholders for later prompts)
    auth/  organizations/  employees/  employee-dna/
    knowledge/  ai-runtime/  collaboration/  audit/  usage/
  lib/
    db/         PostgreSQL-ready database layer (stub)
    security/   Placeholder auth guard (deny-by-default)
    validation/ Shared Zod validation helpers
    env/        Environment validation
  tests/        Vitest tests (env validation + UI terminology guard)
```

## Environment variables

All environment access goes through `src/lib/env/env.ts`, which validates
configuration with Zod and fails fast on invalid values. See `.env.example` for
the full list. Server secrets (`DATABASE_URL`, `AUTH_SECRET`,
`AI_PROVIDER_API_KEY`) are never exposed to the browser; only `NEXT_PUBLIC_*`
values are client-visible.

## Terminology

The user-facing UI uses only Taurus terms (AI Employee, Hiring Studio, Employee
DNA, Knowledge Vault) and never the words *agent*, *prompt*, or *knowledge base*.
`src/tests/terminology.test.ts` enforces this automatically.

## Known limitations (Prompt 001)

- No authentication — the auth guard is a deny-by-default placeholder.
- No database connection — the DB layer is a stub for Prompt 002.
- Pages are placeholders with no real data or forms.
- The organization context uses a placeholder organization.

---

# Authentication, Database, and Tenancy (Prompt 002)

Prompt 002 adds the real database schema, an authentication foundation, and
organization multi-tenancy. You can now sign up, create an organization (you
become its **owner**), and reach an organization-scoped dashboard. Users can
belong to multiple organizations and switch between them.

## Configure your local environment

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.example .env.local     # PowerShell: Copy-Item .env.example .env.local

# 3. Set a session secret (REQUIRED for sign-in). Generate a strong value:
#    openssl rand -base64 32
#    ...and paste it into AUTH_SECRET in .env.local

# 4. Start the dev server
npm run dev
```

Open http://localhost:3000 and use **Create an account** → name your organization
→ you land in the dashboard as the owner.

### Environment variables

| Variable                | Required | Purpose                                                              |
| ----------------------- | -------- | -------------------------------------------------------------------- |
| `AUTH_SECRET`           | Yes\*    | Signs session cookies. Min 16 chars. **Mandatory in production.**    |
| `DATABASE_URL`          | No       | PostgreSQL connection. **If empty, an in-memory store is used.**     |
| `TAURUS_ALLOW_DEV_AUTH` | No       | Set `true` to allow the passwordless dev auth in production.         |
| `NEXT_PUBLIC_APP_URL`   | No       | Public base URL (defaults to `http://localhost:3000`).               |
| `AI_PROVIDER_API_KEY`   | No       | Reserved for later prompts. Server-only; never sent to the browser.  |

\* `AUTH_SECRET` is required for authentication to work; it is only *enforced* at
validation time in production, but sign-in will fail without it in any mode.

Environment is validated in `src/lib/env/env.ts` (Zod). Validation is never
skipped — invalid config fails fast with a readable error.

## Database

The schema lives in [`db/migrations`](db/migrations) and is the source of truth.

- **With PostgreSQL:** set `DATABASE_URL`, then run `npm run db:migrate`
  (optionally `npm run db:migrate:seed`). See [`db/README.md`](db/README.md).
- **Without PostgreSQL:** leave `DATABASE_URL` empty and the app uses an
  in-memory store — ideal for local dev and tests. Data is process-local and
  resets on restart (dev/test only).

## Authentication & tenancy model

- **Sessions:** signed cookies (HMAC via `AUTH_SECRET`), verified in edge
  middleware and re-checked on the server.
- **Provider abstraction:** `src/modules/auth/provider.ts`. The default dev
  provider is passwordless (email only) and is blocked in production unless
  `TAURUS_ALLOW_DEV_AUTH=true`. Swap in Supabase/Clerk here later.
- **Centralized tenant checks** (`src/lib/security/`): `requireUser`,
  `requireOrganizationMember`, `requireRole`, `assertEmployeeInOrganization`.
  A user can only access an organization where they have an **active** membership.
- **Roles:** owner, admin, builder, viewer (least privilege by default) —
  `src/modules/organizations/roles.ts`.
- **Protected routes:** `/dashboard/*` and `/onboarding` require a session
  (enforced by `src/middleware.ts` and the server guards).

## Additional scripts (Prompt 002)

| Command                   | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `npm run db:migrate`      | Apply SQL migrations (requires `DATABASE_URL`) |
| `npm run db:migrate:seed` | Apply migrations, then seed demo data          |

## Known limitations (Prompt 002)

- The dev auth provider is passwordless (a stand-in for Supabase/Clerk).
- The in-memory store is per-process and non-durable; production requires
  `DATABASE_URL`.
- Member invitations and role management UIs are not built yet (later prompts).

---

# AI Employees (Prompt 003)

Prompt 003 adds AI Employee management inside an organization: create, list,
view, edit, pause/activate, and archive. Everything is organization-scoped.

## Routes

| Route                                    | Purpose                                  |
| ---------------------------------------- | ---------------------------------------- |
| `/dashboard/employees`                   | List AI Employees in the current org     |
| `/dashboard/employees/new`               | Hire (create) an AI Employee             |
| `/dashboard/employees/:employeeId`       | Employee profile (Employee Card / detail)|
| `/dashboard/employees/:employeeId/edit`  | Edit an AI Employee                       |

The dashboard overview also shows an **AI Employees** section.

## Model & flow

- **Model** (`src/lib/db/types.ts` → `AiEmployee`): `id`, `organizationId`,
  `name`, `roleTitle`, `department`, `description`, `status`, `visibility`,
  `avatarUrl`, `createdBy`, `createdAt`, `updatedAt`.
- **Status**: `draft`, `training`, `active`, `paused`, `archived`.
- **Visibility**: `private`, `organization`, `network_ready`.
- **Business logic** (`src/modules/employees/service.ts`) is pure and
  organization-scoped; server actions (`.../actions.ts`) resolve the current
  organization server-side and check role permissions before mutating.
- **Archiving is the soft-delete** for employees (important business objects are
  archived, never hard-deleted).
- **Audit events**: `employee.created`, `employee.updated`, `employee.paused`,
  `employee.archived`.

## Permissions (least privilege)

- Create → `employee.create` (owner, admin, builder).
- View → `employee.view` (all roles).
- Edit / pause / archive → `employee.manage` (owner, admin).

Management controls are only shown to users who hold the permission, and are
re-checked server-side.

## Schema

The `ai_employees` table is defined in `db/migrations/0001_init.sql`.
`db/migrations/0002_employees.sql` adds a list-ordering index. `db/seed.sql`
includes a sample AI Employee for the demo organization. No new environment
variables are required for this prompt.

## Known limitations (Prompt 003)

- Archive is a soft-delete (status change); there is no hard-delete by design.
- A `builder` can create employees but not edit/archive them (that requires
  `employee.manage`), per the existing least-privilege role matrix.
- Employee Card detail shows placeholders for Employee DNA, Knowledge Vault,
  usage, and recent activity — those features arrive in later prompts.
- No chat, RAG, voice, marketplace, collaboration, file uploads, or public
  profiles (intentionally out of scope for this prompt).

---

# Hiring Studio (Prompt 004)

Prompt 004 adds the **Hiring Studio** — a guided, non-technical flow for hiring
an AI Employee in under five minutes. It replaces the single-form create page
(`/dashboard/employees/new` now redirects here).

## Route & flow

`/dashboard/hire` — a four-step wizard (with a progress indicator and
Back/Continue):

1. **Choose role** — 9 role templates (Receptionist, Sales, Customer Support,
   HR, Finance, Operations, Legal Assistant, Marketing, Custom). Picking one
   pre-fills sensible defaults.
2. **Describe** — name, role title, department, description, main responsibilities.
3. **Working style** — tone, formality, risk level, escalation preference (plain
   language, no model/prompt settings).
4. **Review & hire** — confirm everything (plus Visibility: Private, Status:
   Draft) and hire.

On success, `/dashboard/hire/success/[employeeId]` shows a confirmation with
links to the new profile and dashboard, and placeholder "next steps" (Employee
DNA, Knowledge Vault, Test Chat, Configure Voice) that are **coming soon** — not
implemented in this prompt.

The dashboard "Hire AI Employee" CTA opens the Hiring Studio.

## Data

The Hiring Studio reuses the Prompt-003 `AiEmployee` model, extended with two
minimal JSON fields (migration `db/migrations/0003_hiring_studio.sql`):

- `responsibilities` (`jsonb`, list of plain-language bullet points)
- `working_style` (`jsonb`: `tone`, `formality`, `riskLevel`, `escalation`)

This is intentionally **not** a full Employee DNA system. Templates and
working-style options live in `src/modules/employees/hiring-templates.ts`; the
pure hiring logic + Zod schema are in `src/modules/employees/hiring.ts`.

## Security

- Authentication + organization are resolved server-side
  (`requireCurrentOrganization`); `organizationId` is never taken from the client.
- The `hireEmployeeAction` re-checks the `employee.create` permission — client
  gating is never trusted alone.
- Hiring records an `employee.created` audit event with minimal, non-sensitive
  metadata, and every read/write stays organization-scoped.

## Known limitations (Prompt 004)

- Working style is stored but does not yet drive AI behavior (that is Employee
  DNA — see Prompt 005 below).
- The success page "Add Employee DNA" step is now live (Prompt 005); the rest
  are inert placeholders.
- No Knowledge Vault, chat/RAG, voice, marketplace, collaboration, billing, tool
  integrations, public profiles, or LLM calls.

---

# Employee DNA (Prompt 005)

Prompt 005 adds a **versioned Employee DNA** foundation — a structured,
enterprise-safe "employee handbook" that defines who an AI Employee is, how it
communicates, what it is responsible for, its boundaries, and when it escalates.
There are no prompts, model settings, or vector language anywhere.

## Route & flow

`/dashboard/employees/:employeeId/dna` — a handbook-style editor with seven
sections: **Identity, Responsibilities, Communication Style, Decision Style,
Boundaries, Company Context, Learning Policy**.

- **Not started → Draft → Published.** Save Draft persists your work; Publish DNA
  promotes the current draft (archiving any previously published version).
- When no DNA exists yet, the editor is **prefilled** from the employee's name,
  role, department, description, and Hiring-Studio responsibilities + working
  style. Nothing is written until you save.
- A deterministic **completion score** (0–100, no AI) shows progress per section.
- The **currently published DNA** is shown read-only, and full **version
  history** is listed (managers can archive versions).
- The employee detail page shows DNA status + published version + a manage CTA,
  and the hire success page's "Add Employee DNA" links here.

## Data

- Table `employee_dna_versions` is reshaped by migration
  `db/migrations/0004_employee_dna.sql`: `id`, `organization_id`, `employee_id`,
  `version_number`, `status` (draft/published/archived), `schema_version`
  (`"1.0"`), `dna` (jsonb), `created_by_user_id`, `published_by_user_id`,
  `published_at`, timestamps. Indexed on org, employee, status, and
  `(employee_id, version_number)`, with **partial unique indexes** enforcing at
  most one draft and one published version per employee.
- Domain lives in `src/modules/employee-dna/`: `schema.ts` (Zod v1 schema +
  defaults), `prefill.ts`, `scoring.ts`, `service.ts`, `actions.ts`. Store
  methods are organization-scoped and consistent across the in-memory and
  PostgreSQL backends.

## Permissions (server-enforced)

- View DNA → `employee.view` (all active members).
- Save draft / edit → `employee_dna.edit` (owner / admin / builder).
- Publish + archive → `employee.manage` (owner / admin). **Builders can draft
  but not publish.**

Every action re-checks permissions server-side, resolves the organization from
the session (never from the client), and is organization-scoped. Cross-org
access returns not found. Audit events: `employee_dna.draft_saved`,
`employee_dna.published`, `employee_dna.archived`.

## Known limitations (Prompt 005)

- Publishing requires structurally valid DNA, not 100% completion (the score is
  informational).
- Employee DNA is stored and versioned but does **not** yet drive runtime
  behavior — no LLM calls, prompt rendering, RAG, chat, or execution.
- No Knowledge Vault, voice, marketplace, collaboration, billing, tool
  integrations, or public profiles.

---

# Taurus UI — Design System (Sprint 005B)

Sprint 005B upgraded the product UI to a premium, monochrome enterprise design
system — no product logic, schema, permissions, auth, or routes changed.

## Visual identity

- **Monochrome only**: black, charcoal, grey, silver, white. No brand color, no
  gradients beyond subtle white-opacity glows / radial highlights.
- **Feel**: premium enterprise SaaS, a calm and powerful "operating system for AI
  Employees" — minimal but not empty, futuristic but not gimmicky.
- **Motion**: subtle page fade-in, hover lift on important cards, smooth button
  and focus transitions. All motion is disabled under
  `prefers-reduced-motion`.

## Tokens

Design tokens live as RGB-channel CSS variables in
[`src/app/globals.css`](src/app/globals.css) and are exposed as Tailwind colors
in [`tailwind.config.ts`](tailwind.config.ts) (so opacity modifiers like
`bg-taurus-primary/10` work):

| Token             | Purpose                    |
| ----------------- | -------------------------- |
| `taurus-app`      | near-black app background  |
| `taurus-surface`  | base surface               |
| `taurus-elevated` | elevated surface / inputs  |
| `taurus-muted`    | muted surface              |
| `taurus-line`     | hairline border            |
| `taurus-strong`   | strong border              |
| `taurus-text`     | primary text (silver-white)|
| `taurus-sub`      | secondary text             |
| `taurus-faint`    | muted text                 |
| `taurus-primary` / `taurus-onPrimary` | white button + its text |
| `taurus-focus`    | focus ring                 |

Radius, shadows (`shadow-taurus-lift`), the `ease-taurus` timing, and the
`fade-in` / `fade-up` animations are also defined in the Tailwind config.

## Component library

Reusable primitives live in [`src/components/ui`](src/components/ui) (import from
`@/components/ui`): `Button`/`buttonClasses`, `Card`, `Badge`/`StatusDot`,
`Label`/`Input`/`Textarea`/`Select`/`Field`/`FormSection`, `Container` /
`PageShell` / `PageHeader` / `SectionHeader`, `Alert` / `FieldError` / `Notice` /
`EmptyState`, `StatCard` / `Progress` / `Skeleton`, and the Hiring Studio
`HiringStepper`.

## Accessibility

- Readable contrast on the dark surfaces; a global `:focus-visible` ring keeps
  every interactive element keyboard-visible.
- All form fields have labels; buttons are native `<button>`/link elements.
- Status is never conveyed by color alone — badges pair labels with a status dot
  whose fill level differs per state (works in greyscale).
- Reduced-motion is respected globally.

---

# Knowledge Vault (Prompt 006)

Prompt 006 adds an organization-scoped **Knowledge Vault** — a secure company
library of documents, notes, and website records that AI Employees can later be
assigned. This sprint is the storage + assignment foundation only: **there is no
retrieval, answering, chat, or crawling yet.**

## Routes

| Route                                            | Purpose                              |
| ------------------------------------------------ | ------------------------------------ |
| `/dashboard/knowledge`                           | Knowledge Vault list + summary       |
| `/dashboard/knowledge/new`                       | Add Knowledge (text / file / website)|
| `/dashboard/knowledge/:sourceId`                 | Source detail                        |
| `/dashboard/knowledge/:sourceId/edit`            | Edit source metadata                 |
| `/dashboard/employees/:employeeId/knowledge`     | Assign/unassign sources to an Employee|

Uploaded files are downloaded only through the authenticated, organization-scoped
route `/dashboard/knowledge/:sourceId/documents/:documentId/download` (forced
attachment, never inline). Files are never served publicly.

## Source types

- **Note** (manual text) — text is stored and previewed; source becomes `ready`.
- **Document** (file upload) — `.txt/.md/.csv/.json` have their text extracted and
  stored (`ready`); `.pdf/.docx` are stored as metadata only (`uploaded`, marked
  "Stored as document") — full document understanding comes later.
- **Website** (URL record) — the address is stored, **never fetched** (no SSRF).
  Automatic website reading is a later sprint.

## Local upload storage

- Files are written to **`storage/uploads/<organizationId>/<opaque-key>`**
  (configurable via the `TAURUS_UPLOAD_DIR` env var). This directory is
  **gitignored** and never placed in `public/`.
- Storage keys are opaque UUIDs — raw filenames are never used as paths. Display
  filenames are sanitized. Each file records a `checksum_sha256`.

## Allowed file types & limits

- Allowed: `.txt`, `.md`, `.csv`, `.json`, `.pdf`, `.docx`.
- Max size: **10 MB**. Empty files and unsupported types are rejected.

## Environment variables

- `TAURUS_UPLOAD_DIR` (optional) — local upload directory. Defaults to
  `storage/uploads`.

## Data & security

- Tables (migration `db/migrations/0005_knowledge_vault.sql`): `knowledge_sources`,
  `knowledge_documents`, `employee_knowledge_sources` (unique on
  `employee_id + knowledge_source_id`). The unused `0001` `knowledge_sources` and
  `knowledge_chunks` placeholders are dropped and replaced.
- Permissions: `knowledge.view` (all roles) to view; `knowledge.manage`
  (owner/admin/builder) to create/edit/archive/assign. Every action re-checks
  permissions server-side and resolves the organization from the session — never
  from the client. Cross-organization access returns not found.
- Audit events (`knowledge_source.created/updated/archived`,
  `knowledge_document.uploaded`, `knowledge_source.assigned_to_employee` /
  `unassigned_from_employee`) record **metadata only** — never file or text
  contents. Text previews are escaped in the UI.

## Not in this prompt

No retrieval/embeddings/vectors/chunking, semantic search, answering, chat,
citations, website crawling, OCR, advanced PDF/DOCX parsing, integrations,
public sharing, marketplace, or voice.

# Model Hub + LLM Gateway (Prompt 006B)

Taurus is provider-agnostic. Admins configure a **Model Hub**; normal users only
pick a simple **Employee Brain** mode (Economy / Balanced / Premium / Privacy
First). Business code never imports a provider SDK — it goes through the internal
LLM Gateway, so Taurus is never locked to any single provider.

## Routes

- `/dashboard/settings/models` — Model Hub overview (default Employee Brain,
  monthly budget, allowed providers, a cost estimate, and provider status).
- `/dashboard/settings/models/configure` — organization model settings
  (routing behavior, exact default/fallback model, allow/block lists, budget).
- `/dashboard/settings/models/catalog` — full model catalog (provider, model,
  tier, features, context, approximate price, best for).
- `/dashboard/settings/models/providers` — provider credentials: Taurus-managed
  availability + bring-your-own-key (BYOK). Only the last four of a saved key is
  ever shown.
- `/dashboard/employees/[employeeId]/brain` — Employee Brain: inherit the
  organization default, pick a simple mode, or (advanced) pin an exact model.

## Gateway (`src/modules/model-gateway`)

- `catalog.ts` — code-authoritative catalog of 8 providers (OpenAI, Anthropic,
  DeepSeek, Moonshot Kimi, Groq/Llama, Google Gemini, Fireworks, custom
  OpenAI-compatible) and their models, with capabilities and **approximate
  snapshot pricing**.
- `pricing.ts` — deterministic cost estimator; returns an "unknown" state when a
  model has no listed price.
- `router.ts` — pure model routing (routing modes ↔ brain modes, capability
  filtering, allow/block lists, fallback).
- `gateway.ts` — `LlmGateway` with `generateText` / `streamText` (foundation) /
  `estimateCost` / `resolveModelForTask` / `validateModelSupportsTask`. Providers
  and the credential resolver are injected. Usage is recorded as **metadata only**
  (token counts, cost, latency — never message contents), and raw provider
  responses are never exposed to the UI.
- `providers/*` — one adapter per provider behind a common `LLMProvider`
  interface. They perform real network calls and are **never invoked from tests
  or any UI in this sprint** (tests use fakes; no external API calls happen).

## Pricing

> Pricing is an estimate and may vary by provider, region, discounts, caching,
> and enterprise agreement.

Prices are a dated snapshot in `catalog.ts` (with source URLs) and are **not
guaranteed**. The UI shows this disclaimer wherever cost appears.

## Environment variables (all optional; server-only)

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`,
  `GROQ_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `FIREWORKS_API_KEY` — when a
  provider's key is set, that provider is offered as **Taurus managed**. Absent
  keys never break local dev or tests; the provider stays visible but not
  runnable.
- `TAURUS_MODEL_CREDENTIALS_MASTER_KEY` — master key used to encrypt BYOK
  provider keys at rest (AES-256-GCM). If it is not set, **BYOK is disabled** in
  the UI (Taurus-managed keys still work).

## Data & security

- Tables (migration `db/migrations/0006_model_hub.sql`): `ai_model_providers`,
  `ai_models` (persistent mirror of the code catalog), `organization_model_settings`,
  `employee_model_settings`, `organization_provider_credentials`,
  `llm_usage_events`. Every organization-scoped table is indexed on
  `organization_id`.
- **API keys are never stored in plaintext** and the encrypted value is never
  returned to the client — only `key_last_four`. The gateway reads the encrypted
  key server-side via a dedicated store method.
- Permissions: `model_hub.view` (all roles) to view catalog/overview;
  `model_hub.manage` (owner/admin only) to change organization/employee model
  settings and provider credentials. Every action re-checks permissions
  server-side and resolves the organization from the session — never the client.
- Audit events (`model_settings.updated`, `model_budget.updated`,
  `employee_brain.updated`, `provider_credential.saved`,
  `provider_credential.disabled`) record **metadata only** — never API keys or
  message contents.

## Not in this prompt

No end-user chat/RAG answers, Knowledge Vault retrieval, embeddings, vector
search, chat/streaming UI, voice, marketplace, collaboration, billing, public
profiles, autonomous tool execution, or website/file crawling. Prompt 007 can
consume the LLM Gateway without importing any provider SDK directly.

# Employee Chat Runtime (Prompt 007)

Test and chat with an AI Employee. Answers are grounded in the employee's
published **Employee DNA** and the **Knowledge Vault** sources assigned to it. The
runtime uses the **Model Hub / LLM Gateway only** — chat code never imports a
provider SDK.

## Route

- `/dashboard/employees/[employeeId]/chat` — "Chat with [Employee Name]". Shows
  role/department/status, DNA status, assigned knowledge count, and the active
  brain (Live vs Local demo). The employee profile has a **Test Chat** CTA and a
  readiness checklist (DNA published / knowledge assigned / Employee Brain
  configured).

## How a chat turn works

1. Auth + organization membership + view permission are re-checked server-side.
2. The employee is loaded organization-scoped (cross-org → not found; archived →
   blocked).
3. The published Employee DNA is loaded (required — see governance below).
4. Relevant excerpts are retrieved from the employee's assigned, non-archived
   Knowledge Vault sources (deterministic lexical search — no embeddings).
5. A runtime context (employee identity + DNA summary + excerpts + safety rules +
   recent history + question) is built and sent to `ModelGateway.generateText`
   with `taskType: "employee_chat"`.
6. User and assistant messages are stored; a usage event and metadata-only audit
   events are recorded; the answer is returned with the **sources used**.

## Preparing Knowledge Vault sources for chat

Text notes and extracted text files (`.txt/.md/.csv/.json`) are split into
internal searchable **excerpts** when you use **Prepare / Refresh Knowledge** on
the chat page. PDFs/DOCX without extracted text are skipped this sprint and are
simply unavailable for grounding (no full parsing yet). The UI never uses the word
"chunk".

## Governance states

- **No published Employee DNA** → chat is blocked with "Publish Employee DNA
  before testing this AI Employee." (CTA to Employee DNA).
- **No assigned knowledge** → chat still works in DNA-only mode; the UI shows
  "This AI Employee has no assigned Knowledge Vault sources yet." and the
  assistant says when it lacks company knowledge (CTA to assign knowledge).
- **No Model Hub provider (production)** → "Configure Model Hub before running
  this AI Employee." (CTA to Model Hub). Fake answers are never served silently in
  production.

## Model Hub usage + Local demo mode

Chat resolves a model from Employee Brain settings → organization default → safe
fallback, all through the gateway. In **local development and tests**, when no
real provider credential is configured, the gateway answers with a deterministic
**Local Demo Brain** (behind the gateway, clearly marked "Local demo mode" in the
UI). It grounds its reply in the retrieved excerpts, or admits when it has no
approved knowledge. The demo brain is **disabled in production** (`NODE_ENV=production`).

## Live providers (environment variables)

Set any of the Model Hub provider keys to run real models (all optional, server
only; absent keys never break dev/tests):
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`,
`GROQ_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `FIREWORKS_API_KEY`. Provider
execution lives entirely in the Model Gateway's adapter layer.

## Data & security

- Tables (migration `db/migrations/0007_employee_chat_runtime.sql`):
  `employee_chat_threads`, `employee_chat_messages`, `knowledge_retrieval_segments`
  (internal excerpts), `employee_chat_retrieval_events` (query **hash** only). All
  organization-scoped and indexed.
- Permissions: `employee_chat.view` + `employee_chat.use` — granted to
  owner/admin/builder/viewer (testing an Employee is a core capability every role
  already holds via `employee.test`).
- Message contents live **only** in `employee_chat_messages`. Audit events
  (`employee_chat.thread_created/message_sent/response_generated/response_failed/
  thread_archived`, `knowledge_retrieval.prepared/searched`) and retrieval events
  store **metadata only** — never full messages, model instructions, raw provider
  responses, or keys.
- Cross-organization access, unassigned knowledge, archived sources, and archived
  employees are never exposed. Provider error details are never leaked to users.

## Not in this prompt

No voice, phone/WebRTC, marketplace, cross-company or internal collaboration,
billing, public profiles, tool/integration execution, autonomous actions, website
crawling, advanced PDF/DOCX parsing, embeddings, vector database, human-approval
workflows, or memory beyond the current chat thread.

# Channels + Website Widget (Prompt 008)

Deploy an AI Employee outside the Taurus dashboard. This sprint fully ships the
**Web** channels (one channel, one public key, four install methods) and reserves
foundation for Messaging / Voice / Workplace channels.

## Channel architecture

Every channel is normalized behind a small abstraction so new channels are a
catalog + provider change, not a rewrite:

- `ChannelProvider` / `ChannelRuntime` interfaces + `NormalizedInboundMessage` /
  `NormalizedOutboundMessage` / `NormalizedChannelSession` / `NormalizedDeliveryEvent`.
- `WebChannelProvider` (runnable) reuses the **Employee Chat Runtime** (Model
  Gateway only). Placeholder providers (Twilio, Meta WhatsApp Cloud, Telnyx,
  SendGrid, Slack, Microsoft Graph, Telegram, …) report unavailable until a
  future sprint adds their transport + authentication.
- Categories: **Website**, **Messaging**, **Phone calls**, **Workplace apps**.

## Create a website channel

1. Open an AI Employee → **Channels** (or **Add to Website** from its profile).
2. Click **Add to Website** to create the web channel (starts as a draft).
3. **Activate** it, then copy an install method below. Edit allowed domains,
   appearance, welcome message, and rate limits in **Channel settings**.

Requires the Employee to be active with published Employee DNA; the runtime also
enforces this on every request.

## Install methods (all use the one public key)

- **Website Widget** — paste before `</body>`:
  ```html
  <script>
    window.TaurusAI = { channelId: "PUBLIC_KEY", theme: "dark", position: "bottom-right" };
  </script>
  <script async src="APP_URL/widget/taurus-widget.js"></script>
  ```
- **Iframe Embed** — `<iframe src="APP_URL/embed/PUBLIC_KEY" width="100%" height="700" …>`.
- **Hosted Chat Link** — `APP_URL/public/chat/PUBLIC_KEY` (no website required).
- **Public API** — `POST APP_URL/api/public/channels/PUBLIC_KEY/messages` with
  `{ "sessionId": "optional", "message": "…" }`.

The widget script is served at `/widget/taurus-widget.js`, is dependency-free,
reads `window.TaurusAI`, and opens the `/embed/PUBLIC_KEY` surface. Set
`NEXT_PUBLIC_APP_URL` so the generated snippets and iframe URLs are correct.

## Local development

- The demo brain answers when no model provider is configured (dev/test only —
  never in production; see the Employee Chat section).
- With an empty domain allowlist, requests are allowed in development; in
  production the widget/API require the request origin to be in the allowlist
  (the hosted page and iframe are same-origin to Taurus and always allowed).

## Security

- Public flows resolve the organization from the **channel public key** — the
  client can never pass `organizationId` or `employeeId`.
- Enforced on every public request: channel is `active`, employee is not
  archived, Employee DNA is published, and only that employee's assigned
  Knowledge Vault sources are used.
- No dashboard auth for public chat; no dashboard data, internal ids, storage
  paths, model provider keys, hidden instructions, or raw Model Gateway errors
  are ever exposed. Only source name/type/preview cross the public boundary.
- Full IP addresses are never stored — only salted hashes (IP + user-agent).
- Audit + channel events are **metadata-only** (never message contents).
- The public API sends CORS headers and handles preflight (`OPTIONS`).
- Channels can be **paused** or **revoked** (archived) at any time.

## Domain allowlist

Add allowed domains (one per line) in Channel settings. Subdomains of a listed
domain are allowed. Cross-origin widget/API calls must match the allowlist in
production; localhost is always allowed in development. Origin checks are always
server-side (never client-only).

## Rate limiting

Requests are limited per channel key, per session, and per IP hash (per-minute
and per-day, configurable per channel). The bundled limiter is in-memory and
per-process. **Production should back the `RateLimiter` interface with Redis** so
limits are shared across instances.

## Not in this prompt

Voice, WhatsApp/SMS/Telegram/Instagram/Messenger, email sending, Slack/Microsoft
Teams, CRM integrations, marketplace, cross-company collaboration, billing, human
handoff, lead routing, calendar booking, and advanced analytics are not built —
only reserved as channel foundation.

# Messaging Channels (Prompt 009)

Deploy an AI Employee to WhatsApp, SMS, and email — reusing the same Employee DNA,
Knowledge Vault, Model Hub, usage tracking, audit, and security as web channels.
This sprint is **foundation**: real messages send only when provider credentials
are configured; otherwise everything runs in **simulated mode**.

## Architecture

- Messaging channels reuse `employee_channels` (`channelType`: `whatsapp` / `sms`
  / `email`) and conversations reuse `public_chat_sessions` +
  `employee_chat_messages`, so replies run through the **Employee Chat Runtime
  (Model Gateway only)** — no LLM providers are called from messaging code.
- Provider adapters (`src/modules/channels/messaging/providers/`) implement one
  interface — `parseInboundWebhook` / `verifyWebhook` / `sendMessage` /
  `parseDeliveryStatus` / `getProviderStatus` — and normalize every provider into
  a common inbound / outbound / delivery shape. Adding a provider is an adapter +
  catalog change.

## WhatsApp / SMS / Email foundation status

- **SMS** — Twilio inbound + delivery parsing, signature verification, outbound
  send (live with credentials).
- **WhatsApp** — Twilio and Meta WhatsApp Cloud (inbound, delivery, GET
  verification challenge, signature verification, outbound send).
- **Email** — SendGrid and Mailgun inbound parsing (HTML is stripped to safe
  plain text, never rendered), signature verification (Mailgun), outbound send.

Not built: voice calls, marketing/bulk messaging, template submission/approval,
mailbox sync, Slack/Teams/Telegram/Instagram/Messenger, CRM, billing.

## Simulated messaging mode

Locally (and in tests) no provider credentials are needed. On a channel's setup
page, **Simulate incoming message** runs a fake inbound message through the full
runtime — it creates a conversation, stores the inbound message, generates a
reply via the Model Gateway, and stores the outbound message as **simulated**
(nothing is sent to a real provider). Simulated mode is clearly labeled and never
sends real messages, even if credentials exist.

## Configure a messaging channel

1. Open an AI Employee → **Channels** → the WhatsApp / SMS / Email card →
   **Set up** (owner/admin).
2. Pick a provider, name the channel, and add the sender identifier (phone number
   or from-address).
3. (Owner/admin) Save provider credentials — stored **encrypted**, never shown
   again (only the last four). Requires `TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY`.
4. Copy the **webhook URL** into the provider console, then **Activate**.

## Webhook URLs

```
POST /api/webhooks/channels/twilio/{publicKey}
POST /api/webhooks/channels/meta-whatsapp/{publicKey}   (+ GET verification)
POST /api/webhooks/channels/sendgrid/{publicKey}
POST /api/webhooks/channels/mailgun/{publicKey}
POST /api/webhooks/channels/custom/{publicKey}
```

The channel + organization are resolved from the URL **public key** — never from
client input. Signatures are verified when credentials are configured; in local
development unverified requests are accepted in simulated mode only.

## Provider environment variables (all optional)

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`,
`META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`,
`META_WHATSAPP_VERIFY_TOKEN`, `SENDGRID_API_KEY`, `MAILGUN_API_KEY`,
`MAILGUN_DOMAIN`, and `TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY` (gates bring-your-
own-key storage). None are required for local dev or tests.

## Security

- No plaintext credentials are ever stored or returned — only provider type,
  label, and `key_last_four`. Bring-your-own-key is disabled unless the master
  key is set.
- Webhook events and audit events are **metadata only** — never message contents,
  raw payloads, or secrets. Contacts are keyed by a salted hash; full IPs are
  never stored.
- Only **active** channels process inbound messages; **archived** employees and
  employees **without published Employee DNA** do not generate replies; knowledge
  stays limited to the employee's assigned Knowledge Vault sources.
- Managing messaging channels and credentials is **owner/admin only**; simulated
  testing is owner/admin/builder; viewing is all roles. Every action re-checks
  permissions server-side; organizationId is never trusted from the browser.
- Provider error details are never leaked to end users.

## Not built yet

Voice calls and real-time audio are **not built**. Marketing automation, bulk
messaging, and campaigns are **not built**. Marketplace, billing, cross-company
collaboration, and CRM integrations are **not built**.

# Voice Call Channel (Prompt 010)

Let an AI Employee answer phone calls — reusing the same Employee DNA, Knowledge
Vault, Model Hub, usage tracking, audit, and organization security as web and
messaging channels. This sprint is **foundation**: the full simulated call flow
works end to end; real-time audio streaming is not built yet.

## Architecture

- Voice channels reuse `employee_channels` (`channelType = "phone_call"`) with a
  voice provider (`simulated_voice` / `twilio_voice` / `telnyx_voice` /
  `vonage_voice`). Reasoning runs through the **Employee Chat Runtime (Model
  Gateway only)** — voice modules never call an LLM provider directly.
- Provider adapters (`src/modules/voice-runtime/providers/`) parse inbound-call +
  status webhooks, verify signatures when configured, and generate provider call
  responses. Speech-to-text (`stt/`) and text-to-speech (`tts/`) live behind their
  own interfaces with simulated + Deepgram/ElevenLabs foundation adapters.

## Simulated Phone Call mode

On the Voice setup page, **Simulate Phone Call** runs the full runtime locally:
start a call, send caller utterances, watch the AI Employee reply (grounded via
Knowledge Vault + DNA), and end the call — all in simulated mode. No telephony, no
audio, no external calls. The transcript is saved; nothing is sent to a provider.

## Provider foundation status

- **Twilio voice** — inbound-call + status parsing, signature verification, and a
  spoken-greeting call response. Foundation only (no live audio streaming).
- **Telnyx voice** — Call Control webhook parsing + a JSON call response.
  Foundation (full signature verification is a later sprint).
- **Vonage voice** — placeholder adapter with parsing + an NCCO greeting response.
- **STT** — `simulated_stt`, `deepgram_stt` (+ `openai_voice` placeholder).
- **TTS** — `simulated_tts`, `elevenlabs_tts`, `deepgram_tts` (+ `cartesia_tts`,
  `azure_speech` placeholders). No raw audio is produced or stored.

## Configure a Voice Channel

1. Open an AI Employee → **Channels** → the **Phone Calls** card → **Set up**
   (owner/admin). Choose a provider, name the channel, add a phone number, and set
   voice style, speech understanding, speaking voice, recording, and transcript
   settings.
2. (Owner/admin) Save provider credentials — stored **encrypted**, never shown
   again. Requires `TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY`.
3. Copy the **connection URL** into your provider console, then **Activate**.

## Voice connection (webhook) URLs

```
POST /api/webhooks/voice/twilio/{publicKey}
POST /api/webhooks/voice/telnyx/{publicKey}
POST /api/webhooks/voice/vonage/{publicKey}
POST /api/webhooks/voice/simulated/{publicKey}
```

The channel + organization are resolved from the URL **public key** — never from
client input. Signatures are verified when configured; in local development
unverified requests are accepted in simulated mode only.

## Environment variables (all optional)

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`,
`VONAGE_API_KEY`, `VONAGE_API_SECRET`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`,
and `TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY`. None are required for local dev or
tests.

## Security

- No plaintext provider credentials are stored or returned — only provider type,
  label, and last-four. BYOK is disabled unless the master key is set.
- **No raw audio is stored** and call recording is metadata-only in this sprint.
- Caller phone numbers are stored as a **salted hash** (never raw); transcript
  content lives only in the transcript store — never in audit or stream events.
- Only **active** channels process calls; **archived** employees and employees
  **without published Employee DNA** never generate voice responses; knowledge
  stays limited to the employee's assigned Knowledge Vault sources.
- Managing Voice Channels + credentials is **owner/admin**; simulating calls is
  owner/admin/builder; viewing is all roles. Every action re-checks permissions
  server-side; organizationId is never trusted from the browser. Provider error
  details are never leaked to callers.

## Not built yet

Production-grade real-time audio streaming, barge-in / interruption handling, real
phone-number purchasing, an outbound dialer, call campaigns, call transfer to
humans, payment collection over the phone, full call-recording storage, advanced
IVR flows, and voice cloning are **not built**. Marketplace, billing, and
cross-company collaboration are **not built**.

# Production Authentication with Supabase Auth (Sprint 012)

Replaces the temporary passwordless development login with production-ready
authentication backed by **Supabase Auth**, while preserving the existing Taurus
user / organization / membership / role model.

## What you get

- Email + password sign up, sign in, and password reset.
- Email OTP / magic link sign in.
- Google and LinkedIn OAuth ("Continue with…").
- Logout, session persistence, and protected routes.
- Every authenticated Supabase user is mapped to a Taurus user record.

Auth methods live on `/login` (sign in) and `/signup` (sign up). `/signin` is an
alias that redirects to `/login`. Password reset uses `/forgot-password` →
emailed link → `/reset-password`.

## How it fits the existing model

- Supabase `auth.users.id` is stored on the Taurus user as
  `users.supabase_auth_user_id` (migration `0011`). Taurus `users.id` remains the
  internal application id; **memberships and role checks are unchanged** and keep
  referencing `users.id`.
- On first sign-in, `resolveTaurusUserForSupabaseIdentity` links an existing
  account with the same email, or creates a new Taurus user — so every Supabase
  user always has exactly one Taurus user.
- The signed-in user is always derived from a **verified server-side session**
  (`supabase.auth.getUser()`), never from client-provided input.

## Environment variables

| Variable                        | Required                     | Notes                                                             |
| ------------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Prod (unless dev auth on)    | Public Supabase project URL. Safe for the browser.                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod (unless dev auth on)    | Public anon key. Safe for the browser.                            |
| `SUPABASE_SERVICE_ROLE_KEY`     | No                           | **Server only**, never exposed to the browser. Not used this sprint. |
| `TAURUS_ALLOW_DEV_AUTH`         | No                           | `true` to allow the passwordless dev flow in production.          |

When the Supabase variables are absent (local dev / tests), the app falls back to
the development auth flow. In production, Supabase is **required** unless
`TAURUS_ALLOW_DEV_AUTH=true` — enforced by env validation.

## Supabase Auth setup

1. Create a project at supabase.com. Copy **Project URL** and the **anon public**
   key (Project Settings → API) into `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. In **Authentication → Providers**, keep **Email** enabled (email+password and
   magic link/OTP work out of the box).
3. In **Authentication → URL Configuration**, set the **Site URL** to your app
   origin and add the redirect URLs below.

## Redirect URLs

Add these to Supabase → Authentication → URL Configuration → **Redirect URLs**:

```
http://localhost:3000/auth/callback
https://YOUR_DOMAIN/auth/callback
```

All OAuth, magic link, and password-reset emails return to `/auth/callback`,
which exchanges the code for a session and routes the user to their dashboard or
onboarding.

## Google OAuth setup

1. In Google Cloud Console, create an **OAuth 2.0 Client ID** (Web application).
2. Authorized redirect URI: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`.
3. In Supabase → Authentication → Providers → **Google**, paste the Client ID and
   Client Secret and enable it.

## LinkedIn OAuth setup

1. Create an app at LinkedIn Developers and enable **Sign In with LinkedIn using
   OpenID Connect**.
2. Authorized redirect URL: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`.
3. In Supabase → Authentication → Providers → **LinkedIn (OIDC)**, paste the
   Client ID and Client Secret and enable it. (The app requests the
   `linkedin_oidc` provider.)

## Vercel / production deployment

1. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and a strong
   `AUTH_SECRET` to your Vercel project environment variables. Add
   `SUPABASE_SERVICE_ROLE_KEY` only if a server task needs it (keep it server-only —
   do not prefix it with `NEXT_PUBLIC_`).
2. Set `NEXT_PUBLIC_APP_URL` to your production origin.
3. Do **not** set `TAURUS_ALLOW_DEV_AUTH` in production — leave the dev flow off.
4. Add your production `/auth/callback` URL to Supabase Redirect URLs and set the
   Supabase Site URL to your production origin.
5. Run migration `0011_supabase_auth.sql` against your database.

## Security notes

- Passwords are handled entirely by Supabase Auth — **no plaintext passwords are
  stored in Taurus tables**.
- The Supabase **service role key is never exposed to the browser**; only the
  public URL + anon key are.
- The authenticated user is always derived server-side from the verified Supabase
  session; the client-provided user id is never trusted.
- Organization isolation and role-based permission checks are unchanged and remain
  enforced.

## Not included (by design)

Enterprise SSO/SAML, SCIM, and multi-factor authentication are out of scope for
this sprint.
