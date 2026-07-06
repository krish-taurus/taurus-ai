"use client";

/**
 * Organization model settings form (Prompt 006B).
 *
 * Admins pick a default routing behavior (which maps to the Employee Brain modes
 * normal users see), an optional exact default/fallback model, allowed/blocked
 * providers, and a monthly budget. All values are validated + re-checked server
 * side; this component only collects input.
 */

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { OrganizationModelSettings, ProviderSlug } from "@/lib/db/types";
import type { AiModel, ModelProvider } from "@/modules/model-gateway/types";
import {
  updateOrganizationModelSettingsAction,
  type ModelHubActionState,
} from "@/modules/model-gateway/actions";
import { ROUTING_MODE_LABELS } from "@/modules/model-gateway/metadata";
import { buttonClasses, Field, FieldError, FormSection, Input, Select } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Saving…" : "Save Model Hub settings"}
    </button>
  );
}

function ModelOptions({ models, providers }: { models: AiModel[]; providers: ModelProvider[] }) {
  return (
    <>
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
    </>
  );
}

export function OrgModelSettingsForm({
  settings,
  models,
  providers,
}: {
  settings: OrganizationModelSettings;
  models: AiModel[];
  providers: ModelProvider[];
}) {
  const [state, formAction] = useFormState(
    updateOrganizationModelSettingsAction,
    {} as ModelHubActionState,
  );

  const isAllowed = (slug: ProviderSlug) => settings.allowedProviderSlugs.includes(slug);
  const isBlocked = (slug: ProviderSlug) => settings.blockedProviderSlugs.includes(slug);

  return (
    <form action={formAction} className="space-y-6">
      <FormSection
        title="Default Employee Brain"
        description="How Taurus picks a model when an Employee inherits the organization default."
      >
        <Field
          label="Routing behavior"
          htmlFor="routingMode"
          hint="Economy favors cost, Premium favors quality, Privacy First favors open models."
        >
          <Select id="routingMode" name="routingMode" defaultValue={settings.routingMode}>
            {(Object.keys(ROUTING_MODE_LABELS) as (keyof typeof ROUTING_MODE_LABELS)[]).map(
              (mode) => (
                <option key={mode} value={mode}>
                  {ROUTING_MODE_LABELS[mode]}
                </option>
              ),
            )}
          </Select>
        </Field>

        <Field
          label="Exact default model"
          htmlFor="defaultModelId"
          optional
          hint="Used for Manual / Locked routing and as a fallback."
        >
          <Select
            id="defaultModelId"
            name="defaultModelId"
            defaultValue={settings.defaultModelId ?? ""}
          >
            <option value="">Automatic (recommended)</option>
            <ModelOptions models={models} providers={providers} />
          </Select>
        </Field>

        <Field label="Fallback model" htmlFor="fallbackModelId" optional>
          <Select
            id="fallbackModelId"
            name="fallbackModelId"
            defaultValue={settings.fallbackModelId ?? ""}
          >
            <option value="">None</option>
            <ModelOptions models={models} providers={providers} />
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title="Providers"
        description="Restrict which providers this organization may use. Leave 'allowed' empty to permit all except those you block."
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-taurus-sub">Allowed providers</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {providers.map((p) => (
              <label
                key={p.slug}
                className="flex items-center gap-2 rounded-lg border border-taurus-line px-3 py-2 text-sm text-taurus-text"
              >
                <input
                  type="checkbox"
                  name="allowedProviderSlugs"
                  value={p.slug}
                  defaultChecked={isAllowed(p.slug)}
                />
                {p.displayName}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-taurus-sub">Blocked providers</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {providers.map((p) => (
              <label
                key={p.slug}
                className="flex items-center gap-2 rounded-lg border border-taurus-line px-3 py-2 text-sm text-taurus-text"
              >
                <input
                  type="checkbox"
                  name="blockedProviderSlugs"
                  value={p.slug}
                  defaultChecked={isBlocked(p.slug)}
                />
                {p.displayName}
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection
        title="Budget"
        description="A soft monthly budget for planning. Enforcement arrives in a later step."
      >
        <Field label="Monthly budget (USD)" htmlFor="monthlyBudgetUsd" optional>
          <Input
            id="monthlyBudgetUsd"
            name="monthlyBudgetUsd"
            type="number"
            min={0}
            step="1"
            defaultValue={settings.monthlyBudgetUsd ?? ""}
            placeholder="e.g. 500"
          />
        </Field>
        <Field
          label="Alert threshold (%)"
          htmlFor="budgetAlertThresholdPercent"
          optional
          hint="Warn admins when spend reaches this percent of the budget."
        >
          <Input
            id="budgetAlertThresholdPercent"
            name="budgetAlertThresholdPercent"
            type="number"
            min={0}
            max={100}
            step="1"
            defaultValue={settings.budgetAlertThresholdPercent ?? ""}
            placeholder="e.g. 80"
          />
        </Field>
      </FormSection>

      {state?.error ? <FieldError>{state.error}</FieldError> : null}

      <div className="flex items-center gap-4">
        <SubmitButton />
        <Link
          href="/dashboard/settings/models"
          className="text-sm font-medium text-taurus-sub transition-colors hover:text-taurus-text"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
