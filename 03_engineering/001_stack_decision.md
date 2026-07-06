# Stack Decision

## Decision

Start with a modular monolith using Next.js and TypeScript.

## Why

The founder has limited resources and needs to move quickly.

A modular monolith allows:

- faster development,
- simpler deployment,
- lower infrastructure cost,
- easier AI-assisted coding,
- clean boundaries for future splitting.

## MVP Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui-compatible components
- PostgreSQL
- pgvector-ready schema
- Supabase Auth or Clerk
- object storage
- provider-agnostic AI adapter

## Avoid for MVP

- Kubernetes
- Kafka
- complex microservices
- custom auth from scratch
- custom vector database unless necessary
- complex marketplace billing
- full voice stack

## Future Upgrade Path

When traction exists:

- split AI Runtime service,
- split Knowledge service,
- add queue,
- add Redis,
- add event bus,
- add analytics warehouse,
- add Kubernetes,
- add enterprise SSO,
- add marketplace infrastructure.
