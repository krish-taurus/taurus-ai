# Database

Taurus AI targets **PostgreSQL** (pgvector-ready). This folder holds the schema
that is the source of truth for the database.

## Files

- `migrations/0001_init.sql` — full initial schema (all tables + indexes).
- `seed.sql` — optional local demo data (one user, one organization, owner
  membership). Never run against production.

## Applying migrations

Set `DATABASE_URL` in `.env.local`, then:

```bash
npm run db:migrate          # apply pending migrations
npm run db:migrate:seed     # apply migrations, then seed demo data
```

The runner (`scripts/migrate.mjs`) tracks applied files in a `schema_migrations`
table, so it is safe to run repeatedly.

## Running without PostgreSQL (local dev / tests)

If `DATABASE_URL` is **not** set, the application falls back to an in-memory data
store (`src/lib/db/in-memory-store.ts`). This lets you run and demo the auth +
organization flow without installing PostgreSQL. Data is process-local and reset
on restart — for development and tests only.

Set `DATABASE_URL` to use the real PostgreSQL-backed store
(`src/lib/db/postgres-store.ts`).
