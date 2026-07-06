# Prompt 005: Employee DNA

## Objective

Implement Employee DNA versioning.

## Page

`/dashboard/employees/:employeeId/dna`

## Fields

- role purpose
- responsibilities
- tone style
- formality
- personality traits
- answer only from knowledge toggle
- escalation threshold
- allowed skills placeholder
- model preference placeholder

## Requirements

- Create DNA version.
- List DNA versions.
- Activate DNA version.
- Prevent deletion of active DNA.
- Show active DNA on Employee Card.
- Create audit events.

## Acceptance criteria

- User can create DNA version.
- User can activate DNA version.
- Active DNA is used by chat runtime later.
- Raw prompt text is not exposed to the user.
