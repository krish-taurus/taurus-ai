"use client";

/**
 * Employee DNA editor (Prompt 005).
 *
 * A handbook-style editor with seven clear sections. It holds the full DNA on the
 * client and submits it (as validated JSON) to the Save Draft / Publish DNA
 * server actions, which re-validate and enforce permissions. No prompt, model, or
 * vector language appears anywhere.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  ListField,
  SelectField,
  TextAreaField,
  TextField,
  ToggleField,
} from "@/components/employee-dna/dna-fields";
import {
  DNA_EMPATHY_LEVELS,
  DNA_ESCALATION_PREFERENCES,
  DNA_FORMALITIES,
  DNA_RESPONSE_LENGTHS,
  DNA_RISK_LEVELS,
  DNA_TONES,
  LEARNING_POLICY_LABELS,
  type EmployeeDnaV1,
} from "@/modules/employee-dna/schema";
import {
  publishDnaAction,
  saveDnaDraftAction,
  type DnaActionState,
} from "@/modules/employee-dna/actions";
import { buttonClasses, Card, FieldError } from "@/components/ui";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-taurus-text">{title}</h2>
      <p className="mt-1 text-sm text-taurus-faint">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("secondary", "lg")}>
      {pending ? "Saving…" : "Save Draft"}
    </button>
  );
}

function PublishButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Publishing…" : "Publish DNA"}
    </button>
  );
}

export function DnaEditor({
  employeeId,
  initialDna,
  canPublish,
}: {
  employeeId: string;
  initialDna: EmployeeDnaV1;
  canPublish: boolean;
}) {
  const [dna, setDna] = useState<EmployeeDnaV1>(initialDna);
  const [saveState, saveAction] = useFormState(saveDnaDraftAction, {} as DnaActionState);
  const [publishState, publishAction] = useFormState(publishDnaAction, {} as DnaActionState);

  function update<S extends keyof EmployeeDnaV1>(section: S, patch: Partial<EmployeeDnaV1[S]>) {
    setDna((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }

  const dnaJson = JSON.stringify(dna);
  const error = publishState?.error ?? saveState?.error;

  return (
    <div className="space-y-6">
      <Section
        title="Identity"
        description="Who this AI Employee is and what it is here to achieve."
      >
        <TextAreaField
          label="Mission"
          value={dna.identity.mission}
          onChange={(v) => update("identity", { mission: v })}
          placeholder="In one or two sentences, what is this AI Employee here to do?"
        />
        <TextField
          label="Role summary"
          value={dna.identity.roleSummary}
          onChange={(v) => update("identity", { roleSummary: v })}
          placeholder="e.g. Customer Support AI in the Support team"
        />
        <ListField
          label="Primary goals"
          value={dna.identity.primaryGoals}
          onChange={(v) => update("identity", { primaryGoals: v })}
          placeholder="e.g. Resolve common questions quickly"
          addLabel="Add goal"
        />
        <ListField
          label="Success looks like"
          value={dna.identity.successCriteria}
          onChange={(v) => update("identity", { successCriteria: v })}
          placeholder="e.g. Customers get accurate answers on the first try"
          addLabel="Add measure"
        />
      </Section>

      <Section
        title="Responsibilities"
        description="What this AI Employee does — and what it should leave to people."
      >
        <ListField
          label="Primary responsibilities"
          value={dna.responsibilities.primaryResponsibilities}
          onChange={(v) => update("responsibilities", { primaryResponsibilities: v })}
          placeholder="e.g. Answer common customer questions"
          addLabel="Add responsibility"
        />
        <ListField
          label="Secondary responsibilities"
          value={dna.responsibilities.secondaryResponsibilities}
          onChange={(v) => update("responsibilities", { secondaryResponsibilities: v })}
          placeholder="e.g. Summarize conversations for the team"
          addLabel="Add responsibility"
        />
        <ListField
          label="Out of scope"
          value={dna.responsibilities.outOfScopeResponsibilities}
          onChange={(v) => update("responsibilities", { outOfScopeResponsibilities: v })}
          placeholder="e.g. Approving refunds"
          addLabel="Add item"
        />
      </Section>

      <Section
        title="Communication Style"
        description="How this AI Employee comes across to people."
      >
        <SelectField
          label="Tone"
          value={dna.communicationStyle.tone}
          onChange={(v) =>
            update("communicationStyle", { tone: v as EmployeeDnaV1["communicationStyle"]["tone"] })
          }
          options={DNA_TONES}
        />
        <SelectField
          label="Formality"
          value={dna.communicationStyle.formality}
          onChange={(v) =>
            update("communicationStyle", {
              formality: v as EmployeeDnaV1["communicationStyle"]["formality"],
            })
          }
          options={DNA_FORMALITIES}
        />
        <SelectField
          label="Empathy level"
          value={dna.communicationStyle.empathyLevel}
          onChange={(v) =>
            update("communicationStyle", {
              empathyLevel: v as EmployeeDnaV1["communicationStyle"]["empathyLevel"],
            })
          }
          options={DNA_EMPATHY_LEVELS}
        />
        <SelectField
          label="Response length"
          value={dna.communicationStyle.responseLength}
          onChange={(v) =>
            update("communicationStyle", {
              responseLength: v as EmployeeDnaV1["communicationStyle"]["responseLength"],
            })
          }
          options={DNA_RESPONSE_LENGTHS}
        />
        <TextAreaField
          label="Brand voice"
          value={dna.communicationStyle.brandVoice}
          onChange={(v) => update("communicationStyle", { brandVoice: v })}
          placeholder="How should this AI Employee sound? Any words or phrases to use or avoid?"
        />
        <ListField
          label="Languages"
          value={dna.communicationStyle.languages}
          onChange={(v) => update("communicationStyle", { languages: v })}
          placeholder="e.g. English"
          addLabel="Add language"
        />
      </Section>

      <Section
        title="Decision Style"
        description="How this AI Employee makes choices and when it involves a person."
      >
        <SelectField
          label="Risk level"
          value={dna.decisionStyle.riskLevel}
          onChange={(v) =>
            update("decisionStyle", { riskLevel: v as EmployeeDnaV1["decisionStyle"]["riskLevel"] })
          }
          options={DNA_RISK_LEVELS}
        />
        <SelectField
          label="When to involve a person"
          value={dna.decisionStyle.escalationPreference}
          onChange={(v) =>
            update("decisionStyle", {
              escalationPreference: v as EmployeeDnaV1["decisionStyle"]["escalationPreference"],
            })
          }
          options={DNA_ESCALATION_PREFERENCES}
        />
        <TextAreaField
          label="Escalation notes"
          value={dna.decisionStyle.whenToEscalate}
          onChange={(v) => update("decisionStyle", { whenToEscalate: v })}
          placeholder="Describe situations where a person should always be involved."
        />
        <ListField
          label="Decision boundaries"
          value={dna.decisionStyle.decisionBoundaries}
          onChange={(v) => update("decisionStyle", { decisionBoundaries: v })}
          placeholder="e.g. Never promise a delivery date"
          addLabel="Add boundary"
        />
      </Section>

      <Section
        title="Boundaries"
        description="What this AI Employee may discuss, and what it must never do."
      >
        <ListField
          label="Allowed topics"
          value={dna.boundaries.allowedTopics}
          onChange={(v) => update("boundaries", { allowedTopics: v })}
          placeholder="e.g. Product features"
          addLabel="Add topic"
        />
        <ListField
          label="Restricted topics"
          value={dna.boundaries.restrictedTopics}
          onChange={(v) => update("boundaries", { restrictedTopics: v })}
          placeholder="e.g. Legal advice"
          addLabel="Add topic"
        />
        <ListField
          label="Never do"
          value={dna.boundaries.neverDo}
          onChange={(v) => update("boundaries", { neverDo: v })}
          placeholder="e.g. Share personal data"
          addLabel="Add rule"
        />
        <TextAreaField
          label="Compliance notes"
          value={dna.boundaries.complianceNotes}
          onChange={(v) => update("boundaries", { complianceNotes: v })}
          placeholder="Any policies or regulations this AI Employee must follow."
        />
      </Section>

      <Section
        title="Company Context"
        description="Background so this AI Employee represents your company well."
      >
        <TextAreaField
          label="Company description"
          value={dna.companyContext.companyDescription}
          onChange={(v) => update("companyContext", { companyDescription: v })}
          placeholder="What does your company do?"
        />
        <TextAreaField
          label="Products and services"
          value={dna.companyContext.productsAndServices}
          onChange={(v) => update("companyContext", { productsAndServices: v })}
          placeholder="What do you offer?"
        />
        <TextAreaField
          label="Target customers"
          value={dna.companyContext.targetCustomers}
          onChange={(v) => update("companyContext", { targetCustomers: v })}
          placeholder="Who do you serve?"
        />
        <ListField
          label="Brand values"
          value={dna.companyContext.brandValues}
          onChange={(v) => update("companyContext", { brandValues: v })}
          placeholder="e.g. Honesty"
          addLabel="Add value"
        />
      </Section>

      <Section
        title="Learning Policy"
        description="Simple habits that keep this AI Employee safe and honest."
      >
        <ToggleField
          label={LEARNING_POLICY_LABELS.askClarifyingQuestions}
          checked={dna.learningPolicy.askClarifyingQuestions}
          onChange={(v) => update("learningPolicy", { askClarifyingQuestions: v })}
        />
        <ToggleField
          label={LEARNING_POLICY_LABELS.admitUncertainty}
          checked={dna.learningPolicy.admitUncertainty}
          onChange={(v) => update("learningPolicy", { admitUncertainty: v })}
        />
        <ToggleField
          label={LEARNING_POLICY_LABELS.citeSourcesWhenAvailable}
          checked={dna.learningPolicy.citeSourcesWhenAvailable}
          onChange={(v) => update("learningPolicy", { citeSourcesWhenAvailable: v })}
        />
        <ToggleField
          label={LEARNING_POLICY_LABELS.escalateWhenPolicyRequires}
          checked={dna.learningPolicy.escalateWhenPolicyRequires}
          onChange={(v) => update("learningPolicy", { escalateWhenPolicyRequires: v })}
        />
      </Section>

      {error ? <FieldError>{error}</FieldError> : null}

      <div className="flex flex-wrap items-center gap-3">
        <form action={saveAction}>
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="dna" value={dnaJson} />
          <SaveButton />
        </form>

        {canPublish ? (
          <form action={publishAction}>
            <input type="hidden" name="employeeId" value={employeeId} />
            <input type="hidden" name="dna" value={dnaJson} />
            <PublishButton />
          </form>
        ) : (
          <p className="text-xs text-taurus-faint">
            An organization admin can publish this Employee DNA.
          </p>
        )}
      </div>
    </div>
  );
}
