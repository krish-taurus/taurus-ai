# Definition of Done

Every feature must satisfy the following before it is considered complete.

## Product

- Matches documented requirement.
- Uses Taurus terminology.
- Has empty state.
- Has loading state.
- Has error state.
- Can be understood by non-technical users.

## Engineering

- TypeScript types are defined.
- API input validation exists.
- Database migration exists if needed.
- Organization membership checks exist.
- Permission checks exist.
- No secrets in code.
- No provider keys in client code.
- No cross-organization data leakage.

## Testing

- Unit tests for business logic where practical.
- Integration tests for critical APIs where practical.
- Manual verification steps documented.
- Permission tests for tenant isolation.

## Observability

- Important actions create audit events.
- Billable actions create usage events.
- Errors are logged safely.
- Sensitive data is not logged.

## Documentation

- README updated.
- API changes documented.
- Environment variables documented.
- Known limitations stated.

## Claude Rule

Claude must not claim completion unless:

- code compiles,
- app starts,
- tests pass or limitations are stated,
- changed files are listed,
- setup commands are provided,
- manual verification steps are provided.
