import "server-only";

/**
 * AI-generated marketplace copy (Sprint 031).
 *
 * Generates a world-class resume headline/summary for an AI Employee, and
 * best-practice descriptions for the knowledge vaults it uses, via the model
 * gateway. The output is GENERIC best-practice guidance text grounded only in the
 * employee's own DNA — it never invents metrics, clients, or proprietary data.
 *
 * Kept out of the (pure, unit-tested) service so the service has no gateway/network
 * dependency; the publish action wires these generators in.
 */

import type { DataStore } from "@/lib/db/store";
import { createLlmGateway } from "@/modules/model-gateway/credential-resolver";
import { MarketplaceError } from "@/modules/marketplace/service";

export interface ListingCopy {
  headline: string;
  summary: string;
}

/** Extract a JSON object from a model reply that may include stray prose. */
function parseCopy(text: string, roleFallback: string): ListingCopy {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]) as { headline?: unknown; summary?: unknown };
      const headline = typeof obj.headline === "string" ? obj.headline : "";
      const summary = typeof obj.summary === "string" ? obj.summary : "";
      if (headline || summary) {
        return {
          headline: (headline || roleFallback || "AI Employee").slice(0, 140),
          summary: summary.slice(0, 1000),
        };
      }
    } catch {
      // fall through to the plain-text fallback
    }
  }
  return { headline: (roleFallback || "AI Employee").slice(0, 140), summary: text.trim().slice(0, 1000) };
}

/** Generate a resume headline + summary from the employee's published DNA. */
export async function generateListingCopy(
  store: DataStore,
  input: { organizationId: string; employeeId: string },
): Promise<ListingCopy> {
  const published = await store.getPublishedEmployeeDna(input.organizationId, input.employeeId);
  if (!published) {
    throw new MarketplaceError("Publish this AI Employee's DNA first, then generate copy from it.");
  }
  const dna = published.dna;
  const system =
    "You write concise, credible copy for an AI Employee's public resume on a hiring " +
    "marketplace. Present it as a top performer for its role, grounded ONLY in the details " +
    "provided. Do NOT invent metrics, percentages, company names, clients, or achievements. " +
    'Reply with STRICT JSON and nothing else: {"headline": string up to 110 chars, ' +
    '"summary": string of 2-3 sentences}.';
  const profile = JSON.stringify({
    role: dna.identity.roleSummary,
    mission: dna.identity.mission,
    primaryGoals: dna.identity.primaryGoals,
    responsibilities: dna.responsibilities.primaryResponsibilities,
    tone: dna.communicationStyle.tone,
  });

  const gateway = createLlmGateway(store);
  let text: string;
  try {
    const resp = await gateway.generateText({
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      taskType: "dna_summary",
      messages: [
        { role: "system", content: system },
        { role: "user", content: profile },
      ],
    });
    text = resp.text ?? "";
  } catch {
    throw new MarketplaceError(
      "AI writing isn't available right now (no model is configured). You can fill the copy in manually.",
    );
  }
  return parseCopy(text, dna.identity.roleSummary);
}

/**
 * Generate a one-line best-practice description of what a knowledge collection
 * (vault) would contain for this role. Best-effort — returns null on any failure
 * so publishing never breaks when AI writing is unavailable.
 */
export async function generateVaultDescription(
  store: DataStore,
  input: { organizationId: string; employeeId: string; roleSummary: string; vaultName: string },
): Promise<string | null> {
  const system =
    "In ONE concise sentence (max 160 chars), describe the best-practice knowledge a top " +
    "performer in the given role would keep in a collection with the given name. General " +
    "best-practice only — do not invent specifics, numbers, or company names. Reply with only " +
    "the sentence, no quotes.";
  try {
    const gateway = createLlmGateway(store);
    const resp = await gateway.generateText({
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      taskType: "knowledge_summary",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Role: ${input.roleSummary}. Collection name: "${input.vaultName}".` },
      ],
    });
    const text = (resp.text ?? "").trim().replace(/^["']|["']$/g, "");
    return text ? text.slice(0, 200) : null;
  } catch {
    return null;
  }
}
