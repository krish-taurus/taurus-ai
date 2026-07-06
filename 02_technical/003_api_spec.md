# API Specification

Base path: `/api`

All APIs must validate:
- authenticated user,
- organization membership,
- role permission where applicable.

## Organizations

### POST /api/organizations

Create organization.

Request:
```json
{
  "name": "Acme Inc.",
  "industry": "SaaS",
  "websiteUrl": "https://example.com",
  "sizeRange": "51-200"
}
```

Response:
```json
{
  "id": "uuid",
  "name": "Acme Inc.",
  "slug": "acme-inc"
}
```

### GET /api/organizations/:organizationId

Get organization.

### GET /api/organizations/:organizationId/members

List organization members.

## AI Employees

### POST /api/organizations/:organizationId/employees

Create AI employee.

Request:
```json
{
  "name": "Maya",
  "roleTitle": "Customer Support AI",
  "department": "Support",
  "template": "customer_support",
  "description": "Answers customer support questions."
}
```

### GET /api/organizations/:organizationId/employees

List employees.

### GET /api/organizations/:organizationId/employees/:employeeId

Get Employee Card data.

### PATCH /api/organizations/:organizationId/employees/:employeeId

Update employee.

### POST /api/organizations/:organizationId/employees/:employeeId/pause

Pause employee.

### POST /api/organizations/:organizationId/employees/:employeeId/archive

Archive employee.

## Employee DNA

### POST /api/organizations/:organizationId/employees/:employeeId/dna

Create DNA version.

Request:
```json
{
  "rolePurpose": "Help customers resolve common support issues.",
  "responsibilities": ["Answer FAQs", "Escalate billing problems"],
  "tone": {
    "style": "friendly",
    "formality": "professional"
  },
  "policies": {
    "answerOnlyFromKnowledge": true
  },
  "escalationRules": {
    "lowConfidenceThreshold": 0.55
  }
}
```

### GET /api/organizations/:organizationId/employees/:employeeId/dna

List DNA versions.

### POST /api/organizations/:organizationId/employees/:employeeId/dna/:dnaVersionId/activate

Activate DNA version.

## Knowledge Vault

### POST /api/organizations/:organizationId/employees/:employeeId/knowledge-sources

Create knowledge source metadata.

### POST /api/organizations/:organizationId/employees/:employeeId/knowledge-sources/:sourceId/upload

Upload file.

### POST /api/organizations/:organizationId/employees/:employeeId/knowledge-sources/:sourceId/process

Process file.

### GET /api/organizations/:organizationId/employees/:employeeId/knowledge-sources

List knowledge sources.

## Chat

### POST /api/organizations/:organizationId/employees/:employeeId/conversations

Create conversation.

### POST /api/organizations/:organizationId/conversations/:conversationId/messages

Send message.

Request:
```json
{
  "content": "What is our refund policy?"
}
```

Response:
```json
{
  "answer": "According to your refund policy...",
  "citations": [],
  "confidence": 0.82
}
```

## Collaboration

### POST /api/organizations/:organizationId/collaboration-requests

Create collaboration request.

Request:
```json
{
  "requestingEmployeeId": "uuid",
  "respondingEmployeeId": "uuid",
  "requestText": "Can you help answer this billing question?"
}
```

### GET /api/organizations/:organizationId/collaboration-requests

List collaboration requests.

### POST /api/organizations/:organizationId/collaboration-requests/:requestId/respond

Generate or submit response.

## Audit

### GET /api/organizations/:organizationId/audit-events

List audit events.

## Usage

### GET /api/organizations/:organizationId/usage

Get usage summary.
