"use client";

/**
 * Hiring Studio wizard (Prompt 004; restyled Sprint 005B).
 *
 * A guided, four-step flow to hire an AI Employee. Deliberately simple and
 * non-technical. State is held on the client across steps; the final Review step
 * submits to the hireEmployeeAction server action, which re-validates and
 * enforces permissions.
 */

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { HiringStepper } from "@/components/hiring/hiring-stepper";
import { hireEmployeeAction, type HireActionState } from "@/modules/employees/hiring-actions";
import {
  ESCALATION_LABELS,
  ESCALATION_OPTIONS,
  FORMALITY_LABELS,
  FORMALITY_OPTIONS,
  HIRING_TEMPLATES,
  RISK_LABELS,
  RISK_OPTIONS,
  TONE_LABELS,
  TONE_OPTIONS,
  getHiringTemplate,
  summarizeWorkingStyle,
} from "@/modules/employees/hiring-templates";
import type {
  EmployeeEscalation,
  EmployeeFormality,
  EmployeeRiskLevel,
  EmployeeTone,
} from "@/lib/db/types";
import { buttonClasses, cn, Field, FieldError, Input, Select, Textarea } from "@/components/ui";

const STEPS = [
  { key: "role", label: "Choose role" },
  { key: "describe", label: "Describe" },
  { key: "style", label: "Working style" },
  { key: "review", label: "Review & hire" },
] as const;

interface StyleState {
  tone: EmployeeTone;
  formality: EmployeeFormality;
  riskLevel: EmployeeRiskLevel;
  escalation: EmployeeEscalation;
}

function HireButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Hiring…" : "Hire AI Employee"}
    </button>
  );
}

export function HiringStudio() {
  const [step, setStep] = useState(1);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [style, setStyle] = useState<StyleState>({
    tone: "professional",
    formality: "balanced",
    riskLevel: "balanced",
    escalation: "ask_when_unsure",
  });
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverState, formAction] = useFormState(hireEmployeeAction, {} as HireActionState);

  function selectTemplate(key: string) {
    const template = getHiringTemplate(key);
    if (!template) return;
    setTemplateKey(key);
    setRoleTitle(template.roleTitle);
    setDepartment(template.department);
    setDescription(template.description);
    setResponsibilities([...template.responsibilities]);
    setStyle({ ...template.workingStyle });
    setClientError(null);
  }

  function goBack() {
    setClientError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function goNext() {
    setClientError(null);
    if (step === 1 && !templateKey) {
      setClientError("Please choose a role to continue.");
      return;
    }
    if (step === 2) {
      if (name.trim().length < 2) {
        setClientError("Please give your AI Employee a name.");
        return;
      }
      if (roleTitle.trim().length < 2) {
        setClientError("Please enter a role title.");
        return;
      }
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  const cleanResponsibilities = responsibilities.map((r) => r.trim()).filter((r) => r.length > 0);

  return (
    <div>
      <div className="mb-8 animate-fade-in">
        <HiringStepper steps={STEPS} currentStep={step} />
      </div>

      <div key={step} className="animate-fade-up">
        {/* Step 1 — Choose role */}
        {step === 1 ? (
          <section aria-labelledby="step-role">
            <h2 id="step-role" className="text-lg font-semibold text-taurus-text">
              What kind of AI Employee do you want to hire?
            </h2>
            <p className="mt-1 text-sm text-taurus-sub">
              Pick a role to start from, or choose Custom to define your own.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HIRING_TEMPLATES.map((template) => {
                const selected = templateKey === template.key;
                return (
                  <button
                    type="button"
                    key={template.key}
                    onClick={() => selectTemplate(template.key)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all duration-200 ease-taurus",
                      selected
                        ? "border-taurus-strong bg-taurus-elevated ring-1 ring-taurus-strong"
                        : "border-taurus-line bg-taurus-surface hover:-translate-y-0.5 hover:border-taurus-strong",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-taurus-text">{template.label}</p>
                      {selected ? (
                        <span
                          aria-hidden
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-taurus-primary text-[10px] font-bold text-taurus-onPrimary"
                        >
                          ✓
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-taurus-sub">{template.tagline}</p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Step 2 — Describe */}
        {step === 2 ? (
          <section aria-labelledby="step-describe" className="max-w-2xl space-y-5">
            <div>
              <h2 id="step-describe" className="text-lg font-semibold text-taurus-text">
                Describe your AI Employee
              </h2>
              <p className="mt-1 text-sm text-taurus-sub">You can change any of this later.</p>
            </div>

            <Field label="Name" htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maya"
              />
            </Field>

            <Field label="Role title" htmlFor="roleTitle">
              <Input
                id="roleTitle"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Customer Support AI"
              />
            </Field>

            <Field label="Department" htmlFor="department" optional>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Support"
              />
            </Field>

            <Field label="Short description" htmlFor="description" optional>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will this AI Employee help with?"
              />
            </Field>

            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-taurus-sub">
                Main responsibilities
              </span>
              <div className="space-y-2">
                {responsibilities.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const next = [...responsibilities];
                        next[index] = e.target.value;
                        setResponsibilities(next);
                      }}
                      placeholder="e.g. Answer common customer questions"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setResponsibilities(responsibilities.filter((_, i) => i !== index))
                      }
                      aria-label="Remove responsibility"
                      className="shrink-0 rounded-lg border border-taurus-line px-2.5 py-2 text-sm text-taurus-faint transition-colors hover:border-taurus-strong hover:text-taurus-text"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setResponsibilities([...responsibilities, ""])}
                className="mt-1 text-sm font-medium text-taurus-text hover:underline"
              >
                + Add responsibility
              </button>
            </div>
          </section>
        ) : null}

        {/* Step 3 — Working style */}
        {step === 3 ? (
          <section aria-labelledby="step-style" className="max-w-2xl space-y-5">
            <div>
              <h2 id="step-style" className="text-lg font-semibold text-taurus-text">
                Choose a working style
              </h2>
              <p className="mt-1 text-sm text-taurus-sub">
                How should your AI Employee come across and handle decisions?
              </p>
            </div>

            <Field label="Tone" htmlFor="tone">
              <Select
                id="tone"
                value={style.tone}
                onChange={(e) => setStyle({ ...style, tone: e.target.value as EmployeeTone })}
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TONE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Formality" htmlFor="formality">
              <Select
                id="formality"
                value={style.formality}
                onChange={(e) =>
                  setStyle({ ...style, formality: e.target.value as EmployeeFormality })
                }
              >
                {FORMALITY_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {FORMALITY_LABELS[f]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Risk level" htmlFor="riskLevel">
              <Select
                id="riskLevel"
                value={style.riskLevel}
                onChange={(e) =>
                  setStyle({ ...style, riskLevel: e.target.value as EmployeeRiskLevel })
                }
              >
                {RISK_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {RISK_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="When should it involve a person?" htmlFor="escalation">
              <Select
                id="escalation"
                value={style.escalation}
                onChange={(e) =>
                  setStyle({ ...style, escalation: e.target.value as EmployeeEscalation })
                }
              >
                {ESCALATION_OPTIONS.map((esc) => (
                  <option key={esc} value={esc}>
                    {ESCALATION_LABELS[esc]}
                  </option>
                ))}
              </Select>
            </Field>
          </section>
        ) : null}

        {/* Step 4 — Review & hire */}
        {step === 4 ? (
          <section aria-labelledby="step-review" className="max-w-2xl">
            <h2 id="step-review" className="text-lg font-semibold text-taurus-text">
              Review and hire
            </h2>
            <p className="mt-1 text-sm text-taurus-sub">
              Here is your employment offer. Hire when you are ready.
            </p>

            <dl className="mt-5 divide-y divide-taurus-line overflow-hidden rounded-xl border border-taurus-line bg-taurus-surface">
              <ReviewRow label="Name" value={name.trim()} />
              <ReviewRow label="Role title" value={roleTitle.trim()} />
              <ReviewRow label="Department" value={department.trim() || "—"} />
              <ReviewRow label="Description" value={description.trim() || "—"} />
              <div className="px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-taurus-faint">
                  Responsibilities
                </dt>
                <dd className="mt-1 text-sm text-taurus-sub">
                  {cleanResponsibilities.length > 0 ? (
                    <ul className="list-inside list-disc space-y-1">
                      {cleanResponsibilities.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <ReviewRow label="Working style" value={summarizeWorkingStyle(style)} />
              <ReviewRow label="Escalation" value={ESCALATION_LABELS[style.escalation]} />
              <ReviewRow label="Visibility" value="Private" />
              <ReviewRow label="Initial status" value="Draft" />
            </dl>

            {serverState?.error ? (
              <div className="mt-4">
                <FieldError>{serverState.error}</FieldError>
              </div>
            ) : null}

            <form action={formAction} className="mt-6 flex items-center justify-between">
              {/* All values submitted as hidden fields; the server re-validates. */}
              <input type="hidden" name="template" value={templateKey ?? "custom"} />
              <input type="hidden" name="name" value={name.trim()} />
              <input type="hidden" name="roleTitle" value={roleTitle.trim()} />
              <input type="hidden" name="department" value={department.trim()} />
              <input type="hidden" name="description" value={description.trim()} />
              {cleanResponsibilities.map((r, i) => (
                <input key={i} type="hidden" name="responsibilities" value={r} />
              ))}
              <input type="hidden" name="tone" value={style.tone} />
              <input type="hidden" name="formality" value={style.formality} />
              <input type="hidden" name="riskLevel" value={style.riskLevel} />
              <input type="hidden" name="escalation" value={style.escalation} />

              <button type="button" onClick={goBack} className={buttonClasses("secondary")}>
                Back
              </button>
              <HireButton />
            </form>
          </section>
        ) : null}
      </div>

      {/* Client-side validation message (steps 1–3) */}
      {clientError ? (
        <div className="mt-5 max-w-2xl">
          <FieldError>{clientError}</FieldError>
        </div>
      ) : null}

      {/* Navigation for steps 1–3 (step 4 has its own Back + Hire) */}
      {step < 4 ? (
        <div className="mt-8 flex items-center justify-between border-t border-taurus-line pt-5">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            className={buttonClasses("secondary")}
          >
            Back
          </button>
          <button type="button" onClick={goNext} className={buttonClasses("primary", "lg")}>
            Continue
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-taurus-faint">{label}</dt>
      <dd className="text-right text-sm text-taurus-text">{value}</dd>
    </div>
  );
}
