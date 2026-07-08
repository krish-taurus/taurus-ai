# Deployment

Taurus AI is a Next.js 14 app and deploys cleanly to **Vercel**. There are two
ways to get automatic per-PR preview URLs — pick **one** (using both causes
duplicate deploys).

## Option A — Vercel Git integration (recommended, no secrets)

1. Go to [vercel.com/new](https://vercel.com/new) and import
   `krish-taurus/taurus-ai`.
2. Vercel auto-detects Next.js — accept the defaults and deploy.
3. Done. Vercel now comments a **Preview** URL on every pull request and
   promotes `main` to Production automatically.

If you use this option, delete `.github/workflows/deploy.yml` so deploys aren't
run twice.

## Option B — GitHub Actions (deploys controlled in-repo)

`.github/workflows/deploy.yml` deploys a preview on each PR and production on
pushes to `main`. It stays dormant (the job passes green but skips) until you add
three repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | run `vercel link` locally, then read `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | same `.vercel/project.json` |

Once set, the workflow posts (and updates) a **Preview deployed: …** comment on
each PR.

## Environment variables

The app runs with **zero required config** — with no `DATABASE_URL` it uses the
in-memory store, which is perfect for previewing the landing page and UI. For a
persistent deployment, set (in the Vercel project's Environment Variables):

- `DATABASE_URL` — PostgreSQL connection string (enables the Postgres store).
- Auth / provider keys as needed (Stripe, model providers, messaging) — all are
  optional and fall back to simulated/dev behavior when absent.

## Local preview

```bash
npm install
npm run build
npm run start   # http://localhost:3000
```
