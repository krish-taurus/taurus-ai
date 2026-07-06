"use client";

/**
 * Reusable form fields for the Employee DNA editor (Prompt 005).
 *
 * Plain, business-friendly inputs — text, long text, choice, list, and yes/no.
 * No technical or model terminology.
 */

import type { ReactNode } from "react";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-taurus-accent focus:outline-none focus:ring-1 focus:ring-taurus-accent";
const labelClass = "block text-sm font-medium text-slate-700";
const helpClass = "mt-1 text-xs text-slate-500";

function FieldShell({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {children}
      {help ? <p className={helpClass}>{help}</p> : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
}) {
  return (
    <FieldShell label={label} help={help}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 ${inputClass}`}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  help,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
  rows?: number;
}) {
  return (
    <FieldShell label={label} help={help}>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 ${inputClass}`}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  help?: string;
}) {
  return (
    <FieldShell label={label} help={help}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 ${inputClass}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function ListField({
  label,
  value,
  onChange,
  placeholder,
  help,
  addLabel = "Add item",
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  help?: string;
  addLabel?: string;
}) {
  return (
    <FieldShell label={label} help={help}>
      <div className="mt-1 space-y-2">
        {value.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => {
                const next = [...value];
                next[index] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={`Remove ${label} item`}
              className="shrink-0 rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-500 hover:bg-slate-50"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...value, ""])}
        className="mt-2 text-sm font-medium text-taurus-accent hover:underline"
      >
        + {addLabel}
      </button>
    </FieldShell>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-taurus-accent focus:ring-taurus-accent"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}
