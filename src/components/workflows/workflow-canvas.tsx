"use client";

/**
 * Workflow canvas — drag-and-drop graph editor (Sprint 054).
 *
 * An n8n-style alternative to the list builder over the SAME WorkflowGraph:
 * nodes are draggable boxes, connections are the flow (a node's outgoing wire is
 * its `next`; a Branch exposes `true` / `false` handles). Click a node to edit it
 * in the side drawer. Saves the graph + node positions via the same action, so
 * the engine and the list builder are untouched.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
  type Connection,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { saveWorkflowAction, type WorkflowActionState } from "@/modules/workflows/actions";
import type { WorkflowGraph } from "@/lib/db/types";
import { buttonClasses, FieldError } from "@/components/ui";
import { StepFields } from "@/components/workflows/step-fields";
import {
  blankStep,
  graphToSteps,
  stepToWorkflowNode,
  STEP_PALETTE,
  TYPE_NAMES,
  type BuilderStep,
  type ChannelOption,
  type EmployeeOption,
  type SourceOption,
  type StepType,
  type WorkflowOption,
} from "@/components/workflows/graph-model";

type StepNodeData = { step: BuilderStep; subtitle: string };
type FlowNode = Node<StepNodeData>;

function subtitleFor(step: BuilderStep, employees: EmployeeOption[]): string {
  switch (step.type) {
    case "employee":
      return employees.find((e) => e.id === step.employeeId)?.name ?? "Pick an employee";
    case "transform":
      return step.template.slice(0, 40) || "Format text";
    case "send_message":
      return step.recipientTemplate ? `→ ${step.recipientTemplate}` : "Set a recipient";
    case "sub_workflow":
      return "Run another workflow";
    case "approval":
      return "Pauses for approval";
    case "refresh_knowledge":
      return step.target === "employee" ? "Re-index employee knowledge" : "Re-index one source";
    case "sync_source":
      return "Re-fetch + re-index";
    case "condition":
      return `${step.left} ${step.operator} ${step.right}`.slice(0, 40);
    default:
      return "";
  }
}

/** A canvas node box, with a top target handle and bottom source handle(s). */
function StepNode({ data, selected }: NodeProps<FlowNode>) {
  const isBranch = data.step.type === "condition";
  return (
    <div
      className={`w-52 rounded-xl border bg-taurus-elevated px-3 py-2.5 shadow-sm transition-colors ${
        selected ? "border-taurus-primary" : "border-taurus-line"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-taurus-strong !bg-taurus-app" />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-taurus-faint">
        {TYPE_NAMES[data.step.type]}
      </div>
      <div className="truncate text-sm text-taurus-text">{data.subtitle}</div>
      {isBranch ? (
        <>
          <Handle id="true" type="source" position={Position.Bottom} style={{ left: "30%" }} className="!h-2 !w-2 !border-taurus-strong !bg-taurus-primary" />
          <Handle id="false" type="source" position={Position.Bottom} style={{ left: "70%" }} className="!h-2 !w-2 !border-taurus-strong !bg-taurus-app" />
          <div className="mt-1 flex justify-between text-[9px] text-taurus-faint">
            <span>true</span>
            <span>false</span>
          </div>
        </>
      ) : (
        <Handle id="next" type="source" position={Position.Bottom} className="!h-2 !w-2 !border-taurus-strong !bg-taurus-app" />
      )}
    </div>
  );
}

const NODE_TYPES = { step: StepNode };

/** Build React Flow nodes + edges from a stored graph. */
function graphToFlow(
  graph: WorkflowGraph,
  employees: EmployeeOption[],
): { nodes: FlowNode[]; edges: Edge[] } {
  const steps = graphToSteps(graph);
  const stepById = new Map(steps.map((s) => [s.id, s]));
  const nodes: FlowNode[] = steps.map((step, i) => ({
    id: step.id,
    type: "step",
    position: graph.layout?.[step.id] ?? { x: 40, y: 40 + i * 150 },
    data: { step, subtitle: subtitleFor(step, employees) },
  }));

  const edges: Edge[] = [];
  const link = (source: string, handle: string, target: string | null) => {
    if (target && stepById.has(target)) {
      edges.push({ id: `${source}:${handle}->${target}`, source, sourceHandle: handle, target });
    }
  };
  for (const node of graph.nodes) {
    if (node.type === "condition") {
      link(node.id, "true", node.nextIfTrue);
      link(node.id, "false", node.nextIfFalse);
    } else if (node.type !== "trigger") {
      link(node.id, "next", node.next);
    }
  }
  return { nodes, edges };
}

/** Build the stored graph from the current canvas nodes + edges. */
function flowToGraph(nodes: FlowNode[], edges: Edge[]): WorkflowGraph {
  const outgoing = (source: string, handle: string) =>
    edges.find((e) => e.source === source && (e.sourceHandle ?? "next") === handle)?.target ?? null;

  const graphNodes = nodes.map((n) => {
    const step = n.data.step;
    if (step.type === "condition") {
      return stepToWorkflowNode(step, {
        next: null,
        nextIfTrue: outgoing(n.id, "true"),
        nextIfFalse: outgoing(n.id, "false"),
      });
    }
    return stepToWorkflowNode(step, { next: outgoing(n.id, "next") });
  });

  // Entry = a node with no incoming edge (topmost); fall back to the first node.
  const hasIncoming = new Set(edges.map((e) => e.target));
  const roots = nodes.filter((n) => !hasIncoming.has(n.id));
  const entry = [...roots].sort((a, b) => a.position.y - b.position.y)[0] ?? nodes[0];

  const layout: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) layout[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };

  return { entryNodeId: entry?.id ?? null, nodes: graphNodes, layout };
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
      {pending ? "Saving…" : "Save workflow"}
    </button>
  );
}

export function WorkflowCanvas({
  workflowId,
  initialGraph,
  employees,
  channels,
  workflows,
  sources,
}: {
  workflowId: string;
  initialGraph: WorkflowGraph;
  employees: EmployeeOption[];
  channels: ChannelOption[];
  workflows: WorkflowOption[];
  sources: SourceOption[];
}) {
  const initial = useMemo(() => graphToFlow(initialGraph, employees), [initialGraph, employees]);
  const [nodes, setNodes] = useState<FlowNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, action] = useFormState(saveWorkflowAction, {} as WorkflowActionState);
  const [mounted, setMounted] = useState(false);
  const addAnchor = useRef(0);
  useEffect(() => setMounted(true), []);

  const graphJson = useMemo(() => JSON.stringify(flowToGraph(nodes, edges)), [nodes, edges]);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );
  const onConnect = useCallback((c: Connection) => {
    setEdges((eds) => {
      // A source handle drives a single connection — replace any existing one.
      const cleaned = eds.filter(
        (e) => !(e.source === c.source && (e.sourceHandle ?? "next") === (c.sourceHandle ?? "next")),
      );
      return addEdge({ ...c, id: `${c.source}:${c.sourceHandle ?? "next"}->${c.target}` }, cleaned);
    });
  }, []);

  const patchSelected = (patch: Partial<BuilderStep>) =>
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedId) return n;
        const step = { ...n.data.step, ...patch } as BuilderStep;
        return { ...n, data: { step, subtitle: subtitleFor(step, employees) } };
      }),
    );

  const addNode = (type: StepType) => {
    const step = blankStep(type, employees, channels, workflows, sources);
    addAnchor.current += 1;
    const node: FlowNode = {
      id: step.id,
      type: "step",
      position: { x: 320, y: 60 + (addAnchor.current % 6) * 80 },
      data: { step, subtitle: subtitleFor(step, employees) },
    };
    setNodes((nds) => [...nds, node]);
    setSelectedId(step.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Palette */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-taurus-faint">Add node:</span>
        {STEP_PALETTE.map((p) => (
          <button key={p.type} type="button" className={buttonClasses("secondary", "sm")} onClick={() => addNode(p.type)}>
            + {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        {/* Canvas */}
        <div className="h-[560px] overflow-hidden rounded-xl border border-taurus-line bg-taurus-app">
          {mounted ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_e, n) => setSelectedId(n.id)}
              onPaneClick={() => setSelectedId(null)}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={18} className="!bg-transparent" />
              <Controls showInteractive={false} />
            </ReactFlow>
          ) : (
            <div className="grid h-full place-items-center text-sm text-taurus-faint">Loading canvas…</div>
          )}
        </div>

        {/* Config drawer */}
        <div className="rounded-xl border border-taurus-line bg-taurus-elevated p-4">
          {selected ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-taurus-text">{TYPE_NAMES[selected.data.step.type]}</span>
                <button type="button" onClick={deleteSelected} className={buttonClasses("danger", "sm")}>
                  Delete
                </button>
              </div>
              <StepFields
                step={selected.data.step}
                employees={employees}
                channels={channels}
                workflows={workflows}
                sources={sources}
                onChange={patchSelected}
              />
            </div>
          ) : (
            <p className="text-sm text-taurus-faint">
              Click a node to edit it, drag between handles to connect steps, or add a node above.
            </p>
          )}
        </div>
      </div>

      {/* Save */}
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="workflowId" value={workflowId} />
        <input type="hidden" name="graph" value={graphJson} />
        <SaveButton />
        {state?.ok ? <span className="text-sm text-taurus-primary">Saved.</span> : null}
        {state?.error ? <FieldError>{state.error}</FieldError> : null}
      </form>
    </div>
  );
}
