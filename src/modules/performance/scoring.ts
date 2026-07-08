/**
 * Performance Review grading engine (Sprint 018) — pure + provider-agnostic.
 *
 * Deterministic methods (contains / exact / regex / no_refusal) grade with ZERO
 * model calls. Model-graded methods (reviewer / grounded) grade via an injected
 * `Reviewer` port that wraps the Model Hub / ai-runtime — no provider SDK here.
 *
 * A case passes only when EVERY criterion passes; the case score is the
 * weight-normalized average of the criterion scores, which feeds the trend.
 */

import type { Criterion, CriterionScore, GradingMethod, ReviewCase } from "@/modules/performance/types";
import { isDeterministicMethod } from "@/modules/performance/types";

/** Token/model usage from one model-graded call, for the usage-cost event. */
export interface ReviewUsage {
  modelId: string;
  providerSlug: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  /** True when the grading ran on the customer's own key (cost 0 to Taurus). */
  byok: boolean;
}

export interface ReviewerInput {
  method: Extract<GradingMethod, "reviewer" | "grounded">;
  label: string;
  guidance: string;
  situation: string;
  output: string;
  /** The case's definition of good (grounding reference). */
  expected: string | null;
}

export interface ReviewerVerdict {
  /** 0–1 quality score. */
  score: number;
  reason: string;
  usage: ReviewUsage | null;
}

/** The grading mechanism — an AI Employee grading via the Model Hub. */
export interface Reviewer {
  grade(input: ReviewerInput): Promise<ReviewerVerdict>;
}

export interface GradedCriterion {
  score: CriterionScore;
  usage: ReviewUsage | null;
}

export interface GradedCase {
  passed: boolean;
  /** Weighted 0–1 score for the case. */
  score: number;
  criterionScores: CriterionScore[];
  /** Usage from any model-graded criteria (for usage-cost events). */
  usages: ReviewUsage[];
}

const REFUSAL_PATTERNS = [
  /i['’ ]?m sorry/i,
  /i cannot help/i,
  /i can['’]?t help/i,
  /i['’ ]?m unable to/i,
  /i cannot assist/i,
  /i can['’]?t assist/i,
  /as an ai/i,
];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function deterministic(
  method: GradingMethod,
  output: string,
  expected: string | null,
): { passed: boolean; reason: string } {
  switch (method) {
    case "contains": {
      if (expected == null || expected === "") return { passed: false, reason: "No expected text set." };
      const passed = output.toLowerCase().includes(expected.toLowerCase());
      return {
        passed,
        reason: passed ? "Output includes the expected text." : "Output is missing the expected text.",
      };
    }
    case "exact": {
      const passed = output.trim() === (expected ?? "").trim();
      return {
        passed,
        reason: passed ? "Output matches exactly." : "Output does not match exactly.",
      };
    }
    case "regex": {
      if (expected == null || expected === "") return { passed: false, reason: "No pattern set." };
      let re: RegExp;
      try {
        re = new RegExp(expected);
      } catch {
        // An invalid pattern is handled gracefully — the criterion simply fails.
        return { passed: false, reason: "The match pattern is invalid." };
      }
      const passed = re.test(output);
      return { passed, reason: passed ? "Output matches the pattern." : "Output does not match the pattern." };
    }
    case "no_refusal": {
      const refused = REFUSAL_PATTERNS.some((re) => re.test(output));
      return {
        passed: !refused,
        reason: refused ? "Output reads as a refusal or non-answer." : "Output answers without refusing.",
      };
    }
    default:
      return { passed: false, reason: "Unsupported grading method." };
  }
}

/** Grade one criterion against the Employee's output. Never throws. */
export async function gradeCriterion(
  criterion: Criterion,
  output: string,
  reviewCase: ReviewCase,
  reviewer?: Reviewer | null,
): Promise<GradedCriterion> {
  const base = {
    criterionId: criterion.id,
    label: criterion.label,
    method: criterion.method,
    weight: criterion.weight,
  };

  if (isDeterministicMethod(criterion.method)) {
    const { passed, reason } = deterministic(criterion.method, output, criterion.expected);
    return { score: { ...base, passed, score: passed ? 1 : 0, reason }, usage: null };
  }

  // Model-graded (reviewer / grounded).
  if (!reviewer) {
    return {
      score: { ...base, passed: false, score: 0, reason: "No reviewer is configured for this run." },
      usage: null,
    };
  }
  try {
    const verdict = await reviewer.grade({
      method: criterion.method as "reviewer" | "grounded",
      label: criterion.label,
      guidance: criterion.guidance,
      situation: reviewCase.situation,
      output,
      expected: reviewCase.expected,
    });
    const score = clamp01(verdict.score);
    const passed = score >= criterion.passThreshold;
    return { score: { ...base, passed, score, reason: verdict.reason }, usage: verdict.usage };
  } catch {
    // A reviewer failure fails only this criterion — the run does not crash.
    return {
      score: { ...base, passed: false, score: 0, reason: "The reviewer could not grade this criterion." },
      usage: null,
    };
  }
}

/** Grade one case: every criterion must pass; score is weight-normalized. */
export async function gradeCase(
  criteria: Criterion[],
  output: string,
  reviewCase: ReviewCase,
  reviewer?: Reviewer | null,
): Promise<GradedCase> {
  const criterionScores: CriterionScore[] = [];
  const usages: ReviewUsage[] = [];
  for (const criterion of criteria) {
    const graded = await gradeCriterion(criterion, output, reviewCase, reviewer);
    criterionScores.push(graded.score);
    if (graded.usage) usages.push(graded.usage);
  }

  const totalWeight = criterionScores.reduce((s, c) => s + c.weight, 0);
  const weighted = criterionScores.reduce((s, c) => s + c.weight * c.score, 0);
  const score = totalWeight > 0 ? weighted / totalWeight : 0;
  // A case passes only if every criterion passes.
  const passed = criterionScores.length > 0 && criterionScores.every((c) => c.passed);
  return { passed, score, criterionScores, usages };
}
