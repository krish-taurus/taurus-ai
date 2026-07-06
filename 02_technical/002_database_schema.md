# Database Schema

## Entity Overview

```text
users
organizations
organization_members
ai_employees
employee_dna_versions
knowledge_sources
knowledge_chunks
conversations
messages
collaboration_requests
audit_events
usage_events
```

## users

```sql
create table users (
  id uuid primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## organizations

```sql
create table organizations (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  industry text,
  website_url text,
  size_range text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## organization_members

```sql
create table organization_members (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
```

Roles:
- owner
- admin
- builder
- viewer

## ai_employees

```sql
create table ai_employees (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  name text not null,
  role_title text not null,
  department text,
  status text not null default 'draft',
  visibility text not null default 'private',
  description text,
  avatar_url text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Statuses:
- draft
- training
- active
- paused
- archived

Visibility:
- private
- organization
- partner
- public_marketplace

## employee_dna_versions

```sql
create table employee_dna_versions (
  id uuid primary key,
  employee_id uuid not null references ai_employees(id),
  organization_id uuid not null references organizations(id),
  version integer not null,
  role_purpose text,
  responsibilities jsonb not null default '[]',
  tone jsonb not null default '{}',
  personality jsonb not null default '{}',
  policies jsonb not null default '{}',
  allowed_skills jsonb not null default '[]',
  knowledge_scope jsonb not null default '{}',
  escalation_rules jsonb not null default '{}',
  model_preferences jsonb not null default '{}',
  is_active boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (employee_id, version)
);
```

## knowledge_sources

```sql
create table knowledge_sources (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  employee_id uuid references ai_employees(id),
  source_type text not null,
  title text not null,
  uri text,
  storage_path text,
  status text not null default 'pending',
  error_message text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## knowledge_chunks

```sql
create table knowledge_chunks (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  employee_id uuid references ai_employees(id),
  knowledge_source_id uuid not null references knowledge_sources(id),
  chunk_index integer not null,
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector,
  created_at timestamptz not null default now()
);
```

## conversations

```sql
create table conversations (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  employee_id uuid not null references ai_employees(id),
  user_id uuid references users(id),
  channel text not null default 'chat',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## messages

```sql
create table messages (
  id uuid primary key,
  conversation_id uuid not null references conversations(id),
  organization_id uuid not null references organizations(id),
  employee_id uuid references ai_employees(id),
  sender_type text not null,
  sender_id uuid,
  content text not null,
  citations jsonb not null default '[]',
  confidence numeric,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

## collaboration_requests

```sql
create table collaboration_requests (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  requesting_employee_id uuid not null references ai_employees(id),
  responding_employee_id uuid not null references ai_employees(id),
  status text not null default 'pending',
  request_text text not null,
  response_text text,
  permission_snapshot jsonb not null default '{}',
  confidence numeric,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
```

## audit_events

```sql
create table audit_events (
  id uuid primary key,
  organization_id uuid references organizations(id),
  actor_type text not null,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
```

## usage_events

```sql
create table usage_events (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  employee_id uuid references ai_employees(id),
  event_type text not null,
  quantity numeric not null default 1,
  unit text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

## Required indexes

```sql
create index idx_org_members_org on organization_members(organization_id);
create index idx_org_members_user on organization_members(user_id);
create index idx_employees_org on ai_employees(organization_id);
create index idx_dna_employee on employee_dna_versions(employee_id);
create index idx_sources_org_employee on knowledge_sources(organization_id, employee_id);
create index idx_chunks_org_employee on knowledge_chunks(organization_id, employee_id);
create index idx_conversations_org_employee on conversations(organization_id, employee_id);
create index idx_messages_conversation on messages(conversation_id);
create index idx_collab_org on collaboration_requests(organization_id);
create index idx_audit_org_created on audit_events(organization_id, created_at desc);
create index idx_usage_org_created on usage_events(organization_id, created_at desc);
```
