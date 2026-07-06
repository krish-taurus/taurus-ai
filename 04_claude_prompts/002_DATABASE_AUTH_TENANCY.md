# Prompt 002: Database, Auth, and Tenancy

## Objective

Implement the database schema, authentication foundation, and organization tenancy.

## Requirements

Create tables:

- users
- organizations
- organization_members
- ai_employees
- employee_dna_versions
- knowledge_sources
- knowledge_chunks
- conversations
- messages
- collaboration_requests
- audit_events
- usage_events

Use the schema in `02_technical/002_database_schema.md`.

## Auth helpers

Implement:

- requireUser()
- requireOrganizationMember(organizationId)
- requireRole(organizationId, allowedRoles)
- assertEmployeeInOrganization(employeeId, organizationId)

## Organization onboarding

User can create organization.

Creator becomes owner.

Dashboard is scoped to selected organization.

## Audit

Create audit event:

- organization.created

## Acceptance criteria

- Migrations exist.
- Organization creation works.
- User becomes owner.
- Dashboard is protected.
- Tenant checks are centralized.
- User cannot access organization they do not belong to.
