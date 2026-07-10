/**
 * Workflow validation (Sprint 048).
 *
 * Zod schemas for the workflow graph + trigger (structure), plus a reference
 * integrity check (do the `next` pointers point at real nodes). Structural
 * validation runs whenever a graph is saved so a malformed definition can never
 * reach the engine; employee existence is checked at RUN time (so you can draft
 * a workflow before every employee is ready).
 */

import { z } from "zod";
import type { WorkflowGraph } from "@/lib/db/types";

export const WORKFLOW_NAME_MAX = 120;
export const MAX_NODES = 50;

const conditionOperatorSchema = z.enum([
  "contains",
  "not_contains",
  "equals",
  "not_equals",
  "is_empty",
  "is_not_empty",
]);

const conditionExpressionSchema = z.object({
  left: z.string().max(4000),
  operator: conditionOperatorSchema,
  right: z.string().max(4000).optional(),
  caseSensitive: z.boolean().optional(),
});

const nodeIdSchema = z.string().min(1).max(64);
const labelSchema = z.string().max(120).optional();

const nodeSchema = z.discriminatedUnion("type", [
  z.object({ id: nodeIdSchema, label: labelSchema, type: z.literal("trigger"), next: z.string().nullable() }),
  z.object({
    id: nodeIdSchema,
    label: labelSchema,
    type: z.literal("employee"),
    employeeId: z.string().min(1),
    messageTemplate: z.string().max(8000),
    next: z.string().nullable(),
  }),
  z.object({
    id: nodeIdSchema,
    label: labelSchema,
    type: z.literal("transform"),
    template: z.string().max(8000),
    next: z.string().nullable(),
  }),
  z.object({
    id: nodeIdSchema,
    label: labelSchema,
    type: z.literal("condition"),
    expression: conditionExpressionSchema,
    nextIfTrue: z.string().nullable(),
    nextIfFalse: z.string().nullable(),
  }),
]);

export const workflowGraphSchema = z.object({
  entryNodeId: z.string().nullable(),
  nodes: z.array(nodeSchema).max(MAX_NODES),
});

export const workflowTriggerSchema = z.object({ type: z.literal("manual") });

export const workflowNameSchema = z.string().trim().min(1).max(WORKFLOW_NAME_MAX);
export const workflowDescriptionSchema = z.string().trim().max(1000);

/**
 * Check that every connection points at a real node and ids are unique. Returns
 * a human-readable message when the graph is inconsistent, else null.
 */
export function validateGraphIntegrity(graph: WorkflowGraph): string | null {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) return `Two steps share the id "${node.id}".`;
    ids.add(node.id);
  }
  if (graph.entryNodeId !== null && !ids.has(graph.entryNodeId)) {
    return "The workflow's starting step no longer exists.";
  }
  const pointsTo: Array<string | null> = [];
  for (const node of graph.nodes) {
    if (node.type === "condition") {
      pointsTo.push(node.nextIfTrue, node.nextIfFalse);
    } else {
      pointsTo.push(node.next);
    }
  }
  for (const target of pointsTo) {
    if (target !== null && !ids.has(target)) {
      return "A step connects to another step that no longer exists.";
    }
  }
  return null;
}
