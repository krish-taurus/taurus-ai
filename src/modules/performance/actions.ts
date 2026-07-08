"use server";

/**
 * Performance Review server actions (Sprint 018).
 *
 * SECURITY: authentication + organization resolved server-side via
 * requireCurrentOrganization(); the organizationId is never taken from the
 * client. The service re-checks performance.manage + the Growth+ plan flag, so
 * client gating is never trusted alone. Only validated inputs reach the service.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { createLlmGateway } from "@/modules/model-gateway/credential-resolver";
import { PerformanceService, type OrgContext } from "@/modules/performance/service";
import {
  createGatewayEmployeeRunner,
  createGatewayReviewer,
} from "@/modules/performance/runtime";
import { GRADING_METHODS } from "@/modules/performance/types";

export interface PerformanceActionState {
  error?: string;
}

async function context(): Promise<OrgContext> {
  const { user, organization, membership } = await requireCurrentOrganization();
  return { organizationId: organization.id, userId: user.id, role: membership.role };
}

function fail(err: unknown, fallback: string): PerformanceActionState {
  return { error: err instanceof Error ? err.message : fallback };
}

const scorecardSchema = z.object({
  name: z.string().trim().min(2, "Give the scorecard a name.").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

const criterionSchema = z.object({
  scorecardId: z.string().min(1),
  label: z.string().trim().min(2, "Name this criterion.").max(120),
  guidance: z.string().trim().min(2, "Describe what good looks like.").max(1000),
  method: z.enum(GRADING_METHODS),
  expected: z.string().trim().max(1000).optional().or(z.literal("")),
  weight: z.coerce.number().positive("Weight must be greater than 0.").max(100),
  passThreshold: z.coerce.number().min(0).max(1).optional(),
  position: z.coerce.number().int().min(0).default(0),
});

const caseSchema = z.object({
  scorecardId: z.string().min(1),
  name: z.string().trim().min(2, "Name this case.").max(120),
  situation: z.string().trim().min(2, "Describe the situation.").max(4000),
  expected: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function createScorecardAction(
  _prev: PerformanceActionState,
  formData: FormData,
): Promise<PerformanceActionState> {
  const ctx = await context();
  const parsed = scorecardSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  let scorecardId: string;
  try {
    const scorecard = await PerformanceService.createScorecard(getStore(), ctx, {
      name: parsed.data.name,
      description: parsed.data.description || null,
    });
    scorecardId = scorecard.id;
  } catch (err) {
    return fail(err, "Could not create the scorecard.");
  }
  revalidatePath("/dashboard/performance");
  redirect(`/dashboard/performance/${scorecardId}`);
}

export async function addCriterionAction(
  _prev: PerformanceActionState,
  formData: FormData,
): Promise<PerformanceActionState> {
  const ctx = await context();
  const parsed = criterionSchema.safeParse({
    scorecardId: formData.get("scorecardId"),
    label: formData.get("label"),
    guidance: formData.get("guidance"),
    method: formData.get("method"),
    expected: formData.get("expected") ?? "",
    weight: formData.get("weight") ?? "1",
    passThreshold: formData.get("passThreshold") ?? undefined,
    position: formData.get("position") ?? "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the criterion." };
  try {
    await PerformanceService.addCriterion(getStore(), ctx, {
      scorecardId: parsed.data.scorecardId,
      label: parsed.data.label,
      guidance: parsed.data.guidance,
      method: parsed.data.method,
      expected: parsed.data.expected || null,
      weight: parsed.data.weight,
      passThreshold: parsed.data.passThreshold,
      position: parsed.data.position,
    });
  } catch (err) {
    return fail(err, "Could not add the criterion.");
  }
  revalidatePath(`/dashboard/performance/${parsed.data.scorecardId}`);
  redirect(`/dashboard/performance/${parsed.data.scorecardId}`);
}

export async function addReviewCaseAction(
  _prev: PerformanceActionState,
  formData: FormData,
): Promise<PerformanceActionState> {
  const ctx = await context();
  const parsed = caseSchema.safeParse({
    scorecardId: formData.get("scorecardId"),
    name: formData.get("name"),
    situation: formData.get("situation"),
    expected: formData.get("expected") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the case." };
  try {
    await PerformanceService.addReviewCase(getStore(), ctx, {
      scorecardId: parsed.data.scorecardId,
      name: parsed.data.name,
      situation: parsed.data.situation,
      expected: parsed.data.expected || null,
    });
  } catch (err) {
    return fail(err, "Could not add the case.");
  }
  revalidatePath(`/dashboard/performance/${parsed.data.scorecardId}`);
  redirect(`/dashboard/performance/${parsed.data.scorecardId}`);
}

export async function startReviewRunAction(
  _prev: PerformanceActionState,
  formData: FormData,
): Promise<PerformanceActionState> {
  const ctx = await context();
  const scorecardId = String(formData.get("scorecardId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!scorecardId || !employeeId) return { error: "Choose a scorecard and an AI Employee." };

  const store = getStore();
  const gateway = createLlmGateway(store);
  let runId: string;
  try {
    const { run } = await PerformanceService.startReviewRun(
      store,
      ctx,
      { scorecardId, employeeId },
      {
        employeeRunner: createGatewayEmployeeRunner(gateway),
        reviewer: createGatewayReviewer(gateway, ctx.organizationId),
      },
    );
    runId = run.id;
  } catch (err) {
    return fail(err, "Could not run the review.");
  }
  revalidatePath(`/dashboard/employees/${employeeId}/performance`);
  redirect(`/dashboard/employees/${employeeId}/performance?run=${runId}`);
}
