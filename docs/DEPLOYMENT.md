# Deployment

Taurus AI is a Next.js 14 app hosted on **Vercel**.

## Vercel Git integration (active)

The repository is connected to Vercel's native Git integration, so deployments
are automatic — no CI secrets or extra workflow required:

- **Every pull request** gets a Preview deployment; the Vercel bot comments the
  URL on the PR (e.g. `taurus-ai-git-<branch>-taurus-ai.vercel.app`).
- **`main`** is promoted to Production on merge.

`vercel.json` pins the Next.js framework preset; everything else is auto-detected.

## Environment variables

The app runs with **zero required config** — with no `DATABASE_URL` it uses the
in-memory store, which is perfect for previewing the landing page and UI. For a
persistent deployment, set these in the Vercel project's Environment Variables:

- `DATABASE_URL` — PostgreSQL connection string (enables the Postgres store).
- Auth / provider keys as needed (Stripe, model providers, messaging) — all are
  optional and fall back to simulated/dev behavior when absent.

## Database migrations

Migrations are **applied manually** — they do not run on deploy. After adding a
migration (or pointing a new environment at a database), run it against that
environment's database:

```bash
DATABASE_URL=<that environment's db> npm run db:migrate
```

The runner (`scripts/migrate.mjs`) is idempotent and tracks applied files in a
`schema_migrations` table, so it is safe to re-run. Skipping this leaves the app
running against an older schema — a newly added table (e.g. `organization_onboarding`
from `0019`) will be missing until the migration is applied. Feature reads should
degrade gracefully, but persistence for that feature won't work until it runs.

## Authentication on preview deployments

The landing page and other public pages work on any preview URL. **Social login
(Google / LinkedIn) does not complete on per-branch preview URLs by default** —
this is expected and is a configuration matter, not an app bug. Two things get in
the way of the OAuth round-trip back to `/auth/callback`:

1. **Supabase redirect allowlist.** OAuth returns to
   `https://<preview-domain>/auth/callback`, but that dynamic per-branch domain is
   not in the Supabase project's allowed **Redirect URLs**, so Supabase rejects it.
   To allow previews, add a wildcard in **Supabase → Authentication → URL
   Configuration → Redirect URLs**, e.g.
   `https://taurus-ai-*-taurus-ai.vercel.app/**`.
2. **Vercel Deployment Protection.** A protected preview sits behind an auth wall,
   so even an allowlisted redirect can't reach the callback. Disable protection for
   previews, or configure a protection-bypass token.

Practical guidance:

- **Just viewing the UI** on a preview — no login needed; public pages render.
- **Testing login on a preview** — use **email + password**, which has no redirect
  round-trip and is unaffected by the two issues above.
- **Testing Google/LinkedIn** — do it on **production**, where `/auth/callback` is a
  stable, allowlisted domain, or apply the two settings above for previews.

Social login also requires the public Supabase keys to be present for the
environment (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and the
provider enabled in Supabase; without the keys the sign-in page falls back to a
"not configured" notice.

## Local preview

```bash
npm install
npm run build
npm run start   # http://localhost:3000
```
