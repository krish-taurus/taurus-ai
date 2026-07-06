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
