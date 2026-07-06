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
