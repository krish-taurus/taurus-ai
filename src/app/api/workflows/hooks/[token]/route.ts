/**
 * Workflow webhook trigger (Sprint 049).
 *
 * POST /api/workflows/hooks/<token>
 *
 * No dashboard auth — the token in the URL is the secret. Only an ACTIVE
 * workflow whose trigger is set to "webhook" will fire; the run executes as a
 * system actor under that workflow's organization, through the same governed
 * engine as a manual run. The request body's `message` (or the raw body) is
 * passed to the first step as {{input}}. Never returns org data — just the run
 * outcome so the caller knows it fired.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { createLlmGateway, isProductionRuntime } from "@/modules/model-gateway/credential-resolver";
import { runWorkflowByWebhookToken } from "@/modules/workflows/service";

export const dynamic = "force-dynamic";

/** Pull a starting message + structured fields from any reasonable body shape. */
function parseInput(raw: string, contentType: string): Record<string, unknown> {
  if (!raw.trim()) return { message: "" };
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const message =
        typeof parsed.message === "string"
          ? parsed.message
          : typeof parsed.text === "string"
            ? parsed.text
            : raw;
      return { ...parsed, message };
    } catch {
      // fall through to treat as text
    }
  }
  return { message: raw };
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const contentType = request.headers.get("content-type") ?? "";
  const raw = await request.text();
  const input = parseInput(raw, contentType);

  const store = getStore();
  const result = await runWorkflowByWebhookToken(
    { store, gateway: createLlmGateway(store), isProduction: isProductionRuntime },
    params.token,
    input,
  );

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "inactive" ? 409 : 422;
    const message =
      result.reason === "not_found"
        ? "No workflow matches this webhook URL."
        : result.reason === "inactive"
          ? "This workflow is not active."
          : "This workflow has no steps to run.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }

  return NextResponse.json(
    { ok: true, runId: result.run.id, status: result.run.status },
    { status: result.run.status === "succeeded" ? 200 : 502 },
  );
}
