-- Migration 0011: Production authentication with Supabase Auth (Sprint 012).
--
-- Links Taurus application users to Supabase Auth identities without changing
-- the existing user/organization/membership/role model. Supabase auth.users.id
-- is stored on the Taurus users row; memberships continue to reference the
-- internal Taurus users.id. Nullable so existing users (and the passwordless
-- dev auth flow) remain valid; unique so one Taurus user maps to one identity.

alter table users
  add column if not exists supabase_auth_user_id text;

create unique index if not exists users_supabase_auth_user_id_key
  on users (supabase_auth_user_id)
  where supabase_auth_user_id is not null;
