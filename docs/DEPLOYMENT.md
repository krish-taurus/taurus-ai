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

## Local preview

```bash
npm install
npm run build
npm run start   # http://localhost:3000
```
