# Prompt 003: AI Employee CRUD and Employee Card

## Objective

Implement AI Employee creation, listing, editing, pausing, archiving, and Employee Card.

## Pages

- `/dashboard/employees`
- `/dashboard/employees/new`
- `/dashboard/employees/:employeeId`

## Create fields

- name
- role title
- department
- template
- description

## Templates

- Receptionist
- Customer Support
- Sales Assistant
- HR Assistant
- Internal Knowledge Assistant
- Recruiting Assistant
- Operations Assistant
- Custom Employee

## Employee Card fields

- name
- role title
- department
- status
- visibility
- description
- active DNA version placeholder
- knowledge source count placeholder
- usage placeholder
- recent activity placeholder

## Audit events

- employee.created
- employee.updated
- employee.paused
- employee.archived

## Acceptance criteria

- User can create employee.
- Employee appears in dashboard.
- Employee Card renders.
- Cross-organization access is blocked.
- Audit events are created.
