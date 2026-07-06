# Security Model

## Security Objective

Taurus must be credible for enterprise pilots from day one.

## Tenant Isolation

Every customer workspace is an organization.

Every tenant-scoped table must include `organization_id`.

Every tenant-scoped query must validate that the current user is an active member of the organization.

## Roles

### Owner

Can:
- manage organization,
- manage billing,
- invite users,
- manage all employees,
- view audit logs,
- delete/archive organization.

### Admin

Can:
- invite users,
- create employees,
- manage knowledge,
- view audit logs.

### Builder

Can:
- create employees,
- edit Employee DNA,
- upload knowledge,
- test employees.

### Viewer

Can:
- view permitted employees,
- test permitted employees,
- view limited dashboard data.

## Employee Visibility

Initial visibility modes:

- private
- organization

Future visibility modes:

- partner
- public_marketplace

## Internal Collaboration Rules

MVP supports collaboration only inside one organization.

Rules:
- requesting employee must belong to same organization,
- responding employee must belong to same organization,
- both employees must be active,
- request must be logged,
- response must be logged,
- permission snapshot must be stored.

## Future Cross-Company Collaboration Requirements

Before enabling cross-company collaboration, Taurus must implement:

- partner allowlists,
- explicit visibility settings,
- topic-level sharing policies,
- redaction,
- human approval workflows,
- billing consent,
- audit trail,
- revocation,
- data retention controls.

## Audit Events

Log:

- organization.created
- member.invited
- member.role_changed
- employee.created
- employee.updated
- employee.paused
- employee.archived
- employee_dna.created
- employee_dna.activated
- knowledge_source.created
- knowledge_source.uploaded
- message.sent
- collaboration_request.created
- collaboration_request.answered
- permission.changed

## Sensitive Data Rules

Do not put full document contents in audit logs.

Do not put API keys in logs.

Do not expose provider keys to browser code.

Do not allow AI-generated responses to bypass permissions.
