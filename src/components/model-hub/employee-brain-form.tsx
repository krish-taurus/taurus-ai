"use client";

/**
 * Employee Brain form (Prompt 006B; reactive preview in Sprint 015).
 *
 * Normal users pick a simple mode; they never need to understand models. Admins
 * can expand "Advanced" to pin an exact model. Inheriting uses the organization
 * default. The preview updates immediately as the selection changes, and shows
 * the model each mode would use. All choices are validated + re-checked server side.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { EmployeeModelSettings } from "@/lib/db/types";
import type { AiModel, ModelProvider } from "@/modules/model-gateway/types";
import {
  updateEmployeeBrainAction,
  type ModelHubActionState,
} from "@/modules/model-gateway/actions";
import { BRAIN_MODES, brainModeForRoutingMode } from "@/modules/model-gateway/metadata";
import { CostEstimateCard } from "@/components/model-hub/cost-estimate-card";
import { buttonClasses, Card, Field, FieldError, Select } from "@/components/ui";

type Selection = "inherit" | "economy" | "balanced" | "premium" | "privacy_first" | "advanced";

/** The model id each non-advanced selection resolves to (for the live preview). */
export type BrainModeModelIds = Record<Exclude<Selection, "advanced">, string | null>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Saving…" : "Save Employee Brain"}
    </button>
  );
}

function initialSelection(settings: EmployeeModelSettings | null): Selection {
  if (!settings) return "inherit";
  if (settings.modelId) return "advanced";
  if (settings.routingMode) {
    const mode = brainModeForRoutingMode(settings.routingMode);
    if (mode) return mode.id;
  }
  return "inherit";
}

export function EmployeeBrainForm({
  employeeId,
  settings,
  models,
  providers,
  modeModelIds,
}: {
  employeeId: string;
  settings: EmployeeModelSettings | null;
  models: AiModel[];
  providers: ModelProvider[];
  modeModelIds: BrainModeModelIds;
}) {
  const [state, formAction] = useFormState(updateEmployeeBrainAction, {} as ModelHubActionState);
  const [selection, setSelection] = useState<Selection>(initialSelection(settings));
  const [advancedModelId, setAdvancedModelId] = useState<string>(settings?.modelId ?? "");

  const options: { id: Selection; label: string; description: string }[] = [
    {
      id: "inherit",
      label: "Inherit organization default",
      description: "Use whatever the organization's Model Hub recommends. Recommended.",
    },
    ...BRAIN_MODES.map((m) => ({
      id: m.id as Selection,
      label: m.label,
      description: m.description,
    })),
    {
      id: "advanced",
      label: "Advanced — choose an exact model",
      description: "Pin a specific model for this Employee.",
    },
  ];

  // The model the preview should show for the current selection, updated live.
  const activeModel = useMemo(() => {
    const modelId = selection === "advanced" ? advancedModelId : modeModelIds[selection];
    return modelId ? (models.find((m) => m.modelId === modelId) ?? null) : null;
  }, [selection, advancedModelId, modeModelIds, models]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="p-6">
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="employeeId" value={employeeId} />

          <fieldset className="space-y-2.5">
            <legend className="sr-only">Employee Brain mode</legend>
            {options.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-taurus-line bg-taurus-elevated px-4 py-3 transition-colors hover:border-taurus-strong"
              >
                <input
                  type="radio"
                  name="selection"
                  value={opt.id}
                  checked={selection === opt.id}
                  onChange={() => setSelection(opt.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-taurus-text">{opt.label}</span>
                  <span className="mt-0.5 block text-sm text-taurus-faint">{opt.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {selection === "advanced" ? (
            <Field label="Exact model" htmlFor="modelId">
              <Select
                id="modelId"
                name="modelId"
                value={advancedModelId}
                onChange={(e) => setAdvancedModelId(e.target.value)}
              >
                <option value="">Select a model…</option>
                {providers.map((provider) => {
                  const forProvider = models.filter((m) => m.providerSlug === provider.slug);
                  if (forProvider.length === 0) return null;
                  return (
                    <optgroup key={provider.slug} label={provider.displayName}>
                      {forProvider.map((m) => (
                        <option key={m.modelId} value={m.modelId}>
                          {m.displayName}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </Select>
            </Field>
          ) : (
            // Keep the field present so a stale advanced value is never submitted.
            <input type="hidden" name="modelId" value="" />
          )}

          {state?.error ? <FieldError>{state.error}</FieldError> : null}

          <div className="flex items-center gap-4">
            <SubmitButton />
            <Link
              href={`/dashboard/employees/${employeeId}`}
              className="text-sm font-medium text-taurus-sub transition-colors hover:text-taurus-text"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>

      <div className="space-y-4">
        {activeModel ? (
          <CostEstimateCard model={activeModel} />
        ) : (
          <Card className="p-5 text-sm text-taurus-faint">
            {selection === "advanced"
              ? "Choose an exact model to preview its cost."
              : "No model is currently available for this selection. Ask an admin to review the Model Hub settings."}
          </Card>
        )}
      </div>
    </div>
  );
}
