# Database integrity & compliance

A fresh Taurus AI database is built by applying every migration in
`db/migrations` in order (`0001` → `0020`) to a **PostgreSQL 16 + pgvector**
instance. This document records the integrity audit of that fresh schema and how
it is verified, so a clean build is reproducible and reviewable.

## How to build a fresh database

```bash
# 1. A Postgres 16 database with the pgvector extension available.
# 2. Apply the full migration chain (idempotent; tracks applied files):
DATABASE_URL=<your db url> npm run db:migrate
```

`db/schema.sql` is a generated `pg_dump --schema-only` snapshot of the result —
the authoritative, reviewable picture of the entire schema (regenerate it after
adding a migration; the migration files remain the source of truth).

## Audit results (fresh schema)

| Check | Result |
| --- | --- |
| Tables | 45 |
| Tables **without** a primary key | 0 |
| Foreign keys (referential integrity) | 109 |
| FK columns **without** a supporting index | 0 (after `0020_fk_indexes.sql`) |
| Extensions | `pgcrypto`, `vector`, `plpgsql` |
| Audit trail | `audit_events` table, indexed by `(organization_id, created_at)` |

**Referential integrity.** Every table has a primary key, and all 109 foreign
keys carry explicit `ON DELETE` behavior (`cascade` for owned children,
`set null` for optional actor references), so there are no orphaned rows and no
dangling references after deletes.

**Index coverage.** `0020_fk_indexes.sql` adds indexes to the 36 foreign-key
columns that previously lacked one. Unindexed FK columns force a sequential scan
of the child table on every parent delete (and on `ON DELETE CASCADE` /
`SET NULL`); indexing them keeps integrity enforcement fast as data grows. The
migration is additive and idempotent (`create index if not exists`), so it does
not change the schema's behavior or affect existing databases.

**Tenant isolation.** Tenant-scoped tables lead with `organization_id`, and
application reads are always keyed by the caller's organization (enforced in the
store layer), so one organization can never read another's data.

**Audit trail.** Mutations write metadata-only rows to `audit_events`
(actor, action, target, timestamp) — never raw payloads or secrets. The
`(organization_id, created_at)` index keeps the per-organization audit view fast.

## Recovering a drifted database

If a database has drifted into an inconsistent state — partial migrations, tables
that exist but `schema_migrations` doesn't record, etc. — `db:migrate` alone
cannot reconcile it (it may fail with errors like `column "…" does not exist`).
When there is **no data to preserve**, reset it to a clean, fully-migrated schema.

**Option A — no local setup (recommended for a Vercel-hosted DB).** In your
database provider's SQL console (Supabase / Neon / Vercel Postgres), drop every
table, then redeploy so the production build's migration step rebuilds the schema
from scratch:

```sql
do $$
declare r record;
begin
  for r in (select tablename from pg_tables where schemaname = 'public') loop
    execute 'drop table if exists public.' || quote_ident(r.tablename) || ' cascade';
  end loop;
end $$;
```

**Option B — local.** With the database's connection string:

```bash
DATABASE_URL=<url> node scripts/reset-db.mjs --force   # DESTRUCTIVE: deletes all data
```

`scripts/reset-db.mjs` drops all public tables and re-applies the full chain. It
refuses to run without `--force` and prints the target host first, so an
accidental run against the wrong database is hard.

## Feature verification (no feature impact)

`src/tests/postgres-integration.test.ts` runs the **real `PostgresStore`**
against a freshly migrated database and exercises the full product flow — create
user + organization, hire an AI Employee, draft and publish Employee DNA, add a
Knowledge Vault source, open a chat thread, deploy a website channel, and the
Sprint 020 onboarding + audit paths — asserting each reads back correctly. It
proves the migration chain produces exactly the schema the application code
expects. The test is inert unless `DATABASE_URL` is set, so the normal
(in-memory) test run is unaffected:

```bash
DATABASE_URL=<fresh db url> npx vitest run src/tests/postgres-integration.test.ts
```
