# Prompt 006: Knowledge Vault

## Objective

Implement Knowledge Vault upload foundation.

## Pages

- `/dashboard/knowledge`
- `/dashboard/employees/:employeeId/knowledge`

## Requirements

- Upload PDF, TXT, or Markdown files.
- Associate source with employee.
- Store source metadata.
- Show processing status.
- Archive source.
- Reprocess placeholder.

## Statuses

- pending
- processing
- ready
- failed
- archived

## Audit events

- knowledge_source.created
- knowledge_source.uploaded
- knowledge_source.processing_started
- knowledge_source.ready
- knowledge_source.failed
- knowledge_source.archived

## Acceptance criteria

- User can upload file.
- Source appears in Knowledge Vault.
- Source is organization-scoped.
- Cross-organization access is blocked.
