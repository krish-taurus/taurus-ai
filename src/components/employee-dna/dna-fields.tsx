"use client";

/**
 * Reusable form fields for the Employee DNA editor (Prompt 005; restyled 005B).
 *
 * Plain, business-friendly inputs — text, long text, choice, list, and yes/no —
 * built on the shared design-system primitives. No technical terminology.
 */

import type { ReactNode } from "react";
import { cn, Input, Label, Select, Textarea } from "@/components/ui";

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
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {help ? <p className="text-xs text-taurus-faint">{help}</p> : null}
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
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
      <Textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
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
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              type="text"
              value={item}
              onChange={(e) => {
                const next = [...value];
                next[index] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={`Remove ${label} item`}
              className="shrink-0 rounded-lg border border-taurus-line px-2.5 py-2 text-sm text-taurus-faint transition-colors hover:border-taurus-strong hover:text-taurus-text"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...value, ""])}
        className="mt-1 text-sm font-medium text-taurus-text hover:underline"
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
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-taurus-line bg-taurus-elevated px-3 py-2.5">
      <span className="text-sm text-taurus-sub">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-taurus-primary" : "bg-taurus-muted",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full transition-transform duration-200",
            checked ? "left-0.5 translate-x-4 bg-taurus-onPrimary" : "left-0.5 bg-taurus-faint",
          )}
        />
      </button>
    </label>
  );
}
