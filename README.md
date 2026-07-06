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
