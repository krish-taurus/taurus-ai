"use client";

/**
 * Hiring Studio wizard (Prompt 004).
 *
 * A guided, four-step flow to hire an AI Employee. Deliberately simple and
 * non-technical — no prompt, model, or vector language anywhere. State is held
 * on the client across steps; the final Review step submits to the
 * hireEmployeeAction server action, which re-validates and enforces permissions.
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

const STEPS = [
  { key: "role", label: "Choose role" },
  { key: "describe", label: "Describe" },
  { key: "style", label: "Working style" },
  { key: "review", label: "Review & hire" },
] as const;

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-taurus-accent focus:outline-none focus:ring-1 focus:ring-taurus-accent";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

interface StyleState {
  tone: EmployeeTone;
  formality: EmployeeFormality;
  riskLevel: EmployeeRiskLevel;
  escalation: EmployeeEscalation;
}

function HireButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-taurus-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-60"
    >
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
      <div className="mb-8">
        <HiringStepper steps={STEPS} currentStep={step} />
      </div>

      {/* Step 1 — Choose role */}
      {step === 1 ? (
        <section aria-labelledby="step-role">
          <h2 id="step-role" className="text-lg font-semibold text-slate-900">
            What kind of AI Employee do you want to hire?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
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
                  className={[
                    "rounded-lg border p-4 text-left transition-colors",
                    selected
                      ? "border-taurus-accent bg-taurus-accent/5 ring-1 ring-taurus-accent"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <p className="font-semibold text-slate-900">{template.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{template.tagline}</p>
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
            <h2 id="step-describe" className="text-lg font-semibold text-slate-900">
              Describe your AI Employee
            </h2>
            <p className="mt-1 text-sm text-slate-600">You can change any of this later.</p>
          </div>

          <div>
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Maya"
            />
          </div>

          <div>
            <label htmlFor="roleTitle" className={labelClass}>
              Role title
            </label>
            <input
              id="roleTitle"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Customer Support AI"
            />
          </div>

          <div>
            <label htmlFor="department" className={labelClass}>
              Department <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={inputClass}
              placeholder="e.g. Support"
            />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Short description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="What will this AI Employee help with?"
            />
          </div>

          <div>
            <span className={labelClass}>Main responsibilities</span>
            <div className="space-y-2">
              {responsibilities.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={item}
                    onChange={(e) => {
                      const next = [...responsibilities];
                      next[index] = e.target.value;
                      setResponsibilities(next);
                    }}
                    className={inputClass}
                    placeholder="e.g. Answer common customer questions"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setResponsibilities(responsibilities.filter((_, i) => i !== index))
                    }
                    aria-label="Remove responsibility"
                    className="shrink-0 rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-500 hover:bg-slate-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setResponsibilities([...responsibilities, ""])}
              className="mt-2 text-sm font-medium text-taurus-accent hover:underline"
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
            <h2 id="step-style" className="text-lg font-semibold text-slate-900">
              Choose a working style
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              How should your AI Employee come across and handle decisions?
            </p>
          </div>

          <div>
            <label htmlFor="tone" className={labelClass}>
              Tone
            </label>
            <select
              id="tone"
              value={style.tone}
              onChange={(e) => setStyle({ ...style, tone: e.target.value as EmployeeTone })}
              className={inputClass}
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TONE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="formality" className={labelClass}>
              Formality
            </label>
            <select
              id="formality"
              value={style.formality}
              onChange={(e) =>
                setStyle({ ...style, formality: e.target.value as EmployeeFormality })
              }
              className={inputClass}
            >
              {FORMALITY_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {FORMALITY_LABELS[f]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="riskLevel" className={labelClass}>
              Risk level
            </label>
            <select
              id="riskLevel"
              value={style.riskLevel}
              onChange={(e) =>
                setStyle({ ...style, riskLevel: e.target.value as EmployeeRiskLevel })
              }
              className={inputClass}
            >
              {RISK_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {RISK_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="escalation" className={labelClass}>
              When should it involve a person?
            </label>
            <select
              id="escalation"
              value={style.escalation}
              onChange={(e) =>
                setStyle({ ...style, escalation: e.target.value as EmployeeEscalation })
              }
              className={inputClass}
            >
              {ESCALATION_OPTIONS.map((esc) => (
                <option key={esc} value={esc}>
                  {ESCALATION_LABELS[esc]}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

      {/* Step 4 — Review & hire */}
      {step === 4 ? (
        <section aria-labelledby="step-review" className="max-w-2xl">
          <h2 id="step-review" className="text-lg font-semibold text-slate-900">
            Review and hire
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Here is your new AI Employee. Hire when you are ready.
          </p>

          <dl className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            <ReviewRow label="Name" value={name.trim()} />
            <ReviewRow label="Role title" value={roleTitle.trim()} />
            <ReviewRow label="Department" value={department.trim() || "—"} />
            <ReviewRow label="Description" value={description.trim() || "—"} />
            <div className="px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Responsibilities
              </dt>
              <dd className="mt-1 text-sm text-slate-700">
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
            <p role="alert" className="mt-4 text-sm text-red-600">
              {serverState.error}
            </p>
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

            <button
              type="button"
              onClick={goBack}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <HireButton />
          </form>
        </section>
      ) : null}

      {/* Client-side validation message (steps 1–3) */}
      {clientError ? (
        <p role="alert" className="mt-5 text-sm text-red-600">
          {clientError}
        </p>
      ) : null}

      {/* Navigation for steps 1–3 (step 4 has its own Back + Hire) */}
      {step < 4 ? (
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-md bg-taurus-accent px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
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
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-right text-sm text-slate-700">{value}</dd>
    </div>
  );
}
