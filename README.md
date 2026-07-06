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
