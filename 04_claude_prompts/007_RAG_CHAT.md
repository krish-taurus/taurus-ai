# Prompt 007: RAG Chat Runtime

## Objective

Implement basic chat with uploaded company knowledge.

## Requirements

- Extract text from text-based files.
- Split into chunks.
- Store chunks.
- Add embedding provider interface.
- Implement fallback keyword search if embeddings are not configured.
- Retrieve relevant chunks.
- Generate answer through LLM adapter.
- Return citations and confidence.

## Page

`/dashboard/employees/:employeeId/chat`

## AI rules

If Employee DNA has answerOnlyFromKnowledge enabled:

- answer only from knowledge,
- cite sources,
- say when knowledge is insufficient,
- do not invent company facts.

## Acceptance criteria

- User can ask a question.
- Employee answers from uploaded knowledge.
- Conversation and messages are saved.
- Usage events are recorded.
- Citations are shown where available.
