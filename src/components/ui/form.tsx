/**
 * Form primitives (Sprint 005B): Label, Input, Textarea, Select, Field,
 * FormSection. Consistent monochrome fields with accessible labels + focus.
 */

import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/components/ui/cn";
import { Card } from "@/components/ui/card";

export const fieldClasses =
  "w-full rounded-lg border border-taurus-line bg-taurus-elevated px-3 py-2 text-sm text-taurus-text placeholder:text-taurus-faint transition-colors duration-200 focus:border-taurus-strong focus:outline-none";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-sm font-medium text-taurus-sub", className)} {...props} />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClasses, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClasses, className)} {...props} />;
}

/** Labeled field wrapper with optional hint text. */
export function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? <span className="ml-1 font-normal text-taurus-faint">(optional)</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-taurus-faint">{hint}</p> : null}
    </div>
  );
}

/** A titled section card used to group related form fields. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-taurus-text">{title}</h2>
      {description ? <p className="mt-1 text-sm text-taurus-faint">{description}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}
