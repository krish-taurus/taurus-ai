/**
 * Performance Review runtime wiring (Sprint 018).
 *
 * Adapts the Model Hub / ai-runtime gateway to the `EmployeeRunner` (produces an
 * Employee's output for a case, pinned to a DNA version) and `Reviewer` (grades
 * an output) ports. Grading respects the org's model access mode via the gateway
 * (managed → budget/mid + cost recorded; BYOK → customer key, cost 0; never a
 * frontier model in managed mode). No provider SDK is imported here.
 */

import type { GatewayRequest, GatewayResponse } from "@/modules/model-gateway/types";
import type { Reviewer, ReviewerInput, ReviewUsage } from "@/modules/performance/scoring";

export interface EmployeeRunInput {
  organizationId: string;
  employeeId: string;
  situation: string;
  /** The pinned DNA context to run with, so the output is reproducible. */
  dnaContext: string;
}

export interface EmployeeRunResult {
  output: string;
  usage: ReviewUsage | null;
}

/** Produces the AI Employee's output for a review case. */
export interface EmployeeRunner {
  run(input: EmployeeRunInput): Promise<EmployeeRunResult>;
}

/** The subset of the gateway the ports need. */
export interface PerformanceGateway {
  generateText(request: GatewayRequest): Promise<GatewayResponse>;
}

function usageFrom(resp: GatewayResponse): ReviewUsage {
  return {
    modelId: resp.modelId,
    providerSlug: resp.providerSlug,
    inputTokens: resp.inputTokens ?? 0,
    cachedInputTokens: resp.cachedInputTokens ?? 0,
    outputTokens: resp.outputTokens ?? 0,
    byok: resp.byok ?? false,
  };
}

/**
 * The Employee runs against the case's situation, pinned to the given DNA
 * context. The employee-output cost is recorded by the gateway (a normal
 * performance_review usage event).
 */
export function createGatewayEmployeeRunner(gateway: PerformanceGateway): EmployeeRunner {
  return {
    async run({ organizationId, employeeId, situation, dnaContext }) {
      const resp = await gateway.generateText({
        organizationId,
        employeeId,
        taskType: "performance_review",
        messages: [
          { role: "system", content: dnaContext },
          { role: "user", content: situation },
        ],
      });
      return { output: resp.text, usage: usageFrom(resp) };
    },
  };
}

function reviewerInstruction(input: ReviewerInput): string {
  const grounding =
    input.method === "grounded" && input.expected
      ? ` The answer must be grounded in this reference and not contradict it:\n${input.expected}`
      : "";
  return (
    `You are an experienced manager reviewing one of your AI Employee's answers on a single ` +
    `quality: "${input.label}". A great answer means: ${input.guidance}.${grounding}\n` +
    `Judge only this quality. Respond ONLY as JSON: {"score": <0 to 1>, "reason": "<one short sentence>"}.`
  );
}

function parseVerdict(text: string): { score: number; reason: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { score?: unknown; reason?: unknown };
      const score = typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
      if (Number.isFinite(score)) {
        return {
          score,
          reason: typeof parsed.reason === "string" ? parsed.reason : "Graded by the reviewer.",
        };
      }
    } catch {
      // fall through to the safe default
    }
  }
  return { score: 0, reason: "Could not read the reviewer's response." };
}

/**
 * Grade via an AI Employee through the Model Hub. The gateway does NOT persist a
 * usage event here (persistUsage:false) — the Performance service records the
 * grading cost itself from the returned usage.
 */
export function createGatewayReviewer(gateway: PerformanceGateway, organizationId: string): Reviewer {
  return {
    async grade(input) {
      const resp = await gateway.generateText({
        organizationId,
        taskType: "performance_review",
        persistUsage: false,
        messages: [
          { role: "system", content: reviewerInstruction(input) },
          {
            role: "user",
            content: `Situation:\n${input.situation}\n\nAI Employee's answer:\n${input.output}`,
          },
        ],
      });
      const { score, reason } = parseVerdict(resp.text);
      return { score, reason, usage: usageFrom(resp) };
    },
  };
}
