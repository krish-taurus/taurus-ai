# Technical Architecture

## MVP Architecture Decision

Start with a modular monolith.

This is deliberate.

A small team can build faster with a single application while maintaining clean boundaries that allow future service extraction.

## MVP Architecture

```text
Browser
  |
  v
Next.js App
  |
  +-- Auth Module
  +-- Organization Module
  +-- Employee Module
  +-- Employee DNA Module
  +-- Knowledge Module
  +-- AI Runtime Module
  +-- Collaboration Module
  +-- Audit Module
  +-- Usage Module
  |
  v
PostgreSQL + pgvector
  |
  v
Object Storage
```

## Future Architecture

```text
Web App
  |
API Gateway
  |
  +-- Identity Service
  +-- Organization Service
  +-- Employee Service
  +-- Knowledge Service
  +-- AI Runtime Service
  +-- Voice Service
  +-- Collaboration Service
  +-- Marketplace Service
  +-- Billing Service
  +-- Analytics Service
  |
Event Bus
  |
Data Platform
```

## Core Modules

### Auth Module

Handles:
- sessions,
- users,
- login,
- signup,
- organization membership.

### Organization Module

Handles:
- company workspace,
- tenant boundary,
- roles,
- members,
- settings.

### Employee Module

Handles:
- AI employee CRUD,
- status,
- visibility,
- profile,
- role,
- department.

### Employee DNA Module

Handles:
- versioned behavior configuration,
- responsibilities,
- tone,
- escalation policy,
- knowledge policy,
- model preference.

### Knowledge Module

Handles:
- uploads,
- source metadata,
- extraction,
- chunks,
- embeddings,
- retrieval.

### AI Runtime Module

Handles:
- provider-agnostic LLM calls,
- prompt assembly from Employee DNA,
- retrieval context,
- citations,
- confidence,
- usage metadata.

### Collaboration Module

Handles:
- internal Collaboration Requests,
- permission checks,
- employee-to-employee question/answer,
- future external collaboration foundation.

### Audit Module

Handles:
- event logging,
- admin review,
- security traceability.

### Usage Module

Handles:
- billable usage,
- message counts,
- file counts,
- collaboration counts,
- token placeholders.

## Provider-Agnostic AI Interface

Business logic must not directly call AI provider SDKs.

All providers must implement an internal interface.

```ts
export interface LLMProvider {
  name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  streamText?(input: GenerateTextInput): AsyncIterable<TextDelta>;
  createEmbedding?(input: EmbeddingInput): Promise<EmbeddingResult>;
}
```

## Deployment

MVP:
- Vercel or similar for web app,
- Supabase or managed PostgreSQL,
- object storage,
- simple worker later.

Later:
- Kubernetes,
- service split,
- Redis,
- event bus,
- observability stack,
- data warehouse.
