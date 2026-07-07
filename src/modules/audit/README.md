# Audit module

Audit events for major actions across an organization.

Events are **written** at mutation sites throughout the app via
`store.createAuditEvent(...)` (metadata only — never card data, secrets, or
message contents). The **read path** powers the Audit dashboard:

- `store.listAuditEvents(organizationId, limit)` — organization-scoped, most
  recent first, implemented identically in the in-memory and PostgreSQL backends.
- `metadata.ts` — turns internal `action` / `targetType` codes into clean,
  business-friendly labels (Taurus terminology) for the UI.
- `/dashboard/audit` — owner/admin only (`audit.view`), organization resolved
  from the session.
