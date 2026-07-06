# Prompt 008: Internal Employee Collaboration

## Objective

Implement Collaboration Requests between AI employees inside the same organization.

## Pages

- `/dashboard/collaboration`
- `/dashboard/employees/:employeeId/collaboration`

## Requirements

- Select requesting employee.
- Select responding employee.
- Enter request text.
- Submit Collaboration Request.
- Generate or submit response.
- Store status.
- Store permission snapshot.
- Log audit event.
- Record usage event.

## Rules

- Both employees must belong to same organization.
- Both employees must be active.
- Cross-organization collaboration is blocked in MVP.

## Acceptance criteria

- Employee A can request help from Employee B.
- Employee B responds using its own DNA and knowledge scope.
- Request and response are visible.
- Audit and usage events are created.
