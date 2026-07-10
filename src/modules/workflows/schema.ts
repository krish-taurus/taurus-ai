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
  z.object({
    id: nodeIdSchema,
    label: labelSchema,
    type: z.literal("send_message"),
    channelId: z.string().min(1),
    recipientTemplate: z.string().max(2000),
    messageTemplate: z.string().max(8000),
    next: z.string().nullable(),
  }),
  z.object({
    id: nodeIdSchema,
    label: labelSchema,
    type: z.literal("sub_workflow"),
    workflowId: z.string().min(1),
    inputTemplate: z.string().max(8000),
    next: z.string().nullable(),
  }),
  z.object({
    id: nodeIdSchema,
    label: labelSchema,
    type: z.literal("approval"),
    instructions: z.string().max(2000),
    next: z.string().nullable(),
  }),
  z.object({
    id: nodeIdSchema,
    label: labelSchema,
    type: z.literal("refresh_knowledge"),
    target: z.enum(["employee", "source"]),
    employeeId: z.string().optional(),
    sourceId: z.string().optional(),
    next: z.string().nullable(),
  }),
]);

export const workflowGraphSchema = z.object({
  entryNodeId: z.string().nullable(),
  nodes: z.array(nodeSchema).max(MAX_NODES),
});

export const SCHEDULE_MIN_MINUTES = 5;

export const workflowTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("manual") }),
  z.object({ type: z.literal("webhook"), token: z.string().min(16).max(64) }),
  z.object({
    type: z.literal("schedule"),
    everyMinutes: z.number().int().min(SCHEDULE_MIN_MINUTES).max(60 * 24 * 30),
    nextRunAt: z.string(),
  }),
  z.object({ type: z.literal("channel"), channelId: z.string().min(1) }),
]);

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
