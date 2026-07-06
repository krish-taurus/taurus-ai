# Prompt 001: Repo Foundation

## Objective

Create the initial Taurus AI application repository.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui-compatible structure
- PostgreSQL-ready database layer
- environment validation
- basic testing setup

## Required folders

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

## Required pages

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

## Required copy

Dashboard empty state:

> You have not hired any AI employees yet. Hire your first AI employee in five minutes.

Primary CTA:

> Hire AI Employee

## Engineering requirements

- Add `.env.example`.
- Add README.
- Add linting.
- Add formatting.
- Add basic test setup.
- Add environment validation.
- Add placeholder auth guard.
- Add placeholder organization context provider.
- Add simple dashboard navigation.

## Acceptance criteria

- App starts locally.
- Placeholder pages render.
- Navigation works.
- Environment validation works.
- Folder structure exists.
- README explains setup.
- No secrets are committed.
- User-facing UI does not use the words agent, prompt, or knowledge base.

Do not build future features yet.
