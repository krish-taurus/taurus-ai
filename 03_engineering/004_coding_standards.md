# Coding Standards

## Language

Use TypeScript.

Avoid `any` unless justified.

## Product Terms

Use:
- employee
- employeeDna
- knowledgeVault
- skill
- collaborationRequest
- employeeCard

Avoid user-facing:
- agent
- prompt
- knowledge base

## Folder Structure

```text
src/
  app/
  components/
  modules/
    auth/
    organizations/
    employees/
    employee-dna/
    knowledge/
    ai-runtime/
    collaboration/
    audit/
    usage/
  lib/
    db/
    security/
    validation/
    env/
  tests/
```

## API Rules

- Validate session.
- Validate organization membership.
- Validate role permission.
- Validate employee belongs to organization.
- Never trust client-provided permission claims.

## Database Rules

- Use UUID primary keys.
- Use organization_id on tenant-scoped tables.
- Add created_at and updated_at.
- Add indexes for common queries.
- Prefer archiving over hard deletion for important business objects.

## AI Rules

- Do not call AI providers from UI components.
- Do not expose provider keys.
- Use provider adapters.
- Record usage metadata.
- Cite sources in RAG responses when available.

## Security Rules

- Never log secrets.
- Never log full private documents in audit metadata.
- Audit security-relevant actions.
- Deny access by default.
