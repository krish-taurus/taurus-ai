# Start Here For Claude

You are Engineer #1 building Taurus AI.

## Company Context

Taurus AI is an agentic employee ecosystem for enterprises.

It lets companies hire, manage, and collaborate with AI employees in five minutes.

The long-term goal is to become the biggest ecosystem, marketplace, and job board for AI employees.

## Product Priority

The first product priority is:

> The world's easiest AI employee platform.

We are not trying to build the most complex AI system first. We are building the easiest credible enterprise system first.

## Mandatory Taurus Terminology

Use these product terms:

- AI Employee, not agent
- Hiring Studio, not agent builder
- Employee DNA, not prompt
- Knowledge Vault, not knowledge base
- Skill, not tool
- Collaboration Request, not agent-to-agent message
- Employee Card, not profile
- AI Team, not multi-agent system

Do not expose technical AI terms in the user-facing UI unless it is an admin/developer view.

## Architecture Decision

Build a modular monolith first.

Use:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui-compatible components
- PostgreSQL-ready schema
- Supabase Auth or Clerk-compatible auth abstraction
- provider-agnostic AI adapter
- clean module boundaries

Do not build microservices yet.

## Non-Negotiables

- Organization isolation is mandatory.
- Every tenant-scoped table must include organization_id.
- Every tenant-scoped query must validate organization membership.
- Major actions must create audit events.
- Billable actions must create usage events.
- Provider API keys must never be exposed to the browser.
- Users should not write prompts in MVP.
- UI must be simple enough for non-technical enterprise users.

## Your First Task: Prompt 001 Only

Create the Taurus AI repo foundation.

### Required folders

```text
src/
  app/
  components/
  modules/
    auth/
    organizations/
    employees/
    employee-dna/
    knowledge/
    ai-runtime/
    collaboration/
    audit/
    usage/
  lib/
    db/
    security/
    validation/
    env/
  tests/
```

### Required pages

Create placeholder pages:

- `/`
- `/login`
- `/signup`
- `/onboarding`
- `/dashboard`
- `/dashboard/employees`
- `/dashboard/employees/new`
- `/dashboard/knowledge`
- `/dashboard/collaboration`
- `/dashboard/audit`
- `/dashboard/settings`

### Dashboard empty state copy

Use this exact copy:

> You have not hired any AI employees yet. Hire your first AI employee in five minutes.

Primary CTA:

> Hire AI Employee

### Engineering requirements

- Set up Next.js with TypeScript.
- Add Tailwind.
- Add linting.
- Add formatting.
- Add basic test setup.
- Add `.env.example`.
- Add environment validation.
- Add README setup instructions.
- Add placeholder auth guard.
- Add placeholder organization context provider.
- Add simple navigation shell.

### Acceptance criteria

The task is complete only when:

- The app starts locally.
- Placeholder pages render.
- Navigation works.
- Environment validation works.
- Folder structure exists.
- README explains setup.
- No secrets are committed.
- User-facing UI does not use the words agent, prompt, or knowledge base.

### Output required

After implementation, provide:

1. Changed file list
2. Setup commands
3. Test commands
4. Manual verification steps
5. Known limitations
6. Next recommended prompt

Do not build future prompts yet.
Do not claim completion unless the app can start locally.
