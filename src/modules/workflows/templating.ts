/**
 * Workflow templating + condition evaluation (Sprint 048) — pure, no I/O.
 *
 * Data flows between workflow steps through a run CONTEXT. A step reads earlier
 * outputs with `{{ ... }}` references and its result is written back into the
 * context for later steps. Everything here is deterministic and dependency-free
 * so it can be unit-tested in isolation and never touches the model or store.
 *
 * Supported references (safe, no code execution):
 *   {{input}}              → the run's starting text (trigger input)
 *   {{trigger.input}}      → same as {{input}}
 *   {{trigger.<field>}}    → any other trigger field (e.g. the inbound sender)
 *   {{steps.<nodeId>.output}} → a previous step's output
 *   {{<nodeId>}}           → shorthand for that step's output
 */

import type { WorkflowConditionExpression } from "@/lib/db/types";

export interface RunContext {
  /** The run's starting text (from the trigger payload). */
  triggerInput: string;
  /** Other trigger payload fields (e.g. an inbound sender id), as strings. */
  triggerFields: Record<string, string>;
  /** Each executed node's output, keyed by node id. */
  steps: Record<string, { output: string }>;
}

export function emptyContext(
  triggerInput = "",
  triggerFields: Record<string, string> = {},
): RunContext {
  return { triggerInput, triggerFields, steps: {} };
}

/** Flatten a trigger payload into string fields usable in {{trigger.<field>}}. */
export function triggerFieldsFrom(input: Record<string, unknown> | undefined): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!input) return fields;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") fields[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") fields[key] = String(value);
  }
  return fields;
}

/** Resolve a single `{{ ... }}` reference path to a string (missing → ""). */
function resolveReference(context: RunContext, rawPath: string): string {
  const path = rawPath.trim();
  if (path === "input" || path === "trigger.input") return context.triggerInput;
  if (path.startsWith("trigger.")) {
    return context.triggerFields[path.slice("trigger.".length)] ?? "";
  }
  if (path.startsWith("steps.")) {
    // steps.<nodeId>.output — take the node id between the dots.
    const rest = path.slice("steps.".length);
    const nodeId = rest.split(".")[0];
    return context.steps[nodeId]?.output ?? "";
  }
  // {{ <nodeId> }} shorthand for that step's output.
  return context.steps[path]?.output ?? "";
}

/**
 * Interpolate `{{ ... }}` references in a template against the run context.
 * Unknown references resolve to an empty string (never throws), so an author
 * mistake degrades gracefully instead of failing the run.
 */
export function interpolate(template: string, context: RunContext): string {
  return template.replace(/\{\{([^}]*)\}\}/g, (_match, expr: string) =>
    resolveReference(context, expr),
  );
}

/** Evaluate a condition (branch) node's expression against the run context. */
export function evaluateCondition(
  expression: WorkflowConditionExpression,
  context: RunContext,
): boolean {
  const left = interpolate(expression.left, context);
  const rightRaw = expression.right ?? "";
  const right = interpolate(rightRaw, context);

  const fold = (s: string) => (expression.caseSensitive ? s : s.toLowerCase());
  const l = fold(left);
  const r = fold(right);

  switch (expression.operator) {
    case "contains":
      return r.length > 0 && l.includes(r);
    case "not_contains":
      return !(r.length > 0 && l.includes(r));
    case "equals":
      return l === r;
    case "not_equals":
      return l !== r;
    case "is_empty":
      return left.trim().length === 0;
    case "is_not_empty":
      return left.trim().length > 0;
    default:
      return false;
  }
}
