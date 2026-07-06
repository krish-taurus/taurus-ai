# AI Runtime

## Goal

The AI Runtime powers Taurus AI Employees while keeping the platform provider-agnostic.

## Runtime Input

- organization context,
- employee identity,
- active Employee DNA,
- user message,
- conversation history,
- retrieved knowledge chunks,
- security policy,
- allowed skills,
- channel.

## Runtime Output

- response text,
- citations,
- confidence,
- usage metadata,
- optional collaboration suggestion,
- audit metadata.

## MVP Runtime Flow

```text
User message
  |
Load organization and employee
  |
Load active Employee DNA
  |
Retrieve relevant Knowledge Vault chunks
  |
Generate response using LLM adapter
  |
Attach citations and confidence
  |
Save message
  |
Record usage
  |
Return answer
```

## Provider Interface

```ts
export type GenerateTextInput = {
  system: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
};

export type GenerateTextResult = {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  raw?: unknown;
};

export interface LLMProvider {
  name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}
```

## Employee DNA to System Instruction

Users configure Employee DNA.

The system converts Employee DNA into internal instructions.

Raw system prompts are not exposed to business users in MVP.

## Knowledge Policy

If `answerOnlyFromKnowledge` is true:

- answer only from retrieved knowledge,
- cite sources,
- say when knowledge is insufficient,
- do not invent company facts.

If false:

- answer with general reasoning,
- clearly separate company-specific facts from general advice.

## Confidence Policy

MVP confidence can be heuristic.

High confidence:
- relevant chunks found,
- answer cites sources,
- answer directly matches user question.

Medium confidence:
- partial evidence.

Low confidence:
- no relevant source,
- weak evidence,
- conflicting information.

Low confidence response should include:

> I do not have enough approved company knowledge to answer that confidently.

## Future Capabilities

- model routing,
- tool/skill calling,
- voice,
- memory,
- planning,
- evaluation,
- certification,
- trust score.
