# Prompt 009: Audit and Usage

## Objective

Implement audit and usage dashboards.

## Audit page

`/dashboard/audit`

Show:

- timestamp
- actor
- action
- target
- summary

## Usage page

`/dashboard/usage`

Show:

- messages sent
- employees created
- files uploaded
- collaboration requests
- token usage placeholder
- storage usage placeholder

## Requirements

- Create createAuditEvent() helper.
- Create recordUsageEvent() helper.
- Add pagination.
- Add filters where practical.

## Acceptance criteria

- Major actions appear in audit log.
- Usage counts update.
- Organization isolation is enforced.
