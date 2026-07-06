/**
 * Feedback primitives (Sprint 005B): Alert, FieldError, Notice, EmptyState.
 *
 * Monochrome. Errors and notices never rely on color alone — they use a glyph,
 * a label, and role="alert"/"status" so they are clear in greyscale.
 */

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** Inline validation error for forms. */
export function FieldError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-taurus-strong bg-taurus-muted px-3 py-2 text-sm text-taurus-text"
    >
      <span aria-hidden className="mt-px font-semibold">
        !
      </span>
      <span>{children}</span>
    </p>
  );
}

/** A calm confirmation/status banner. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-lg border border-taurus-line bg-taurus-muted px-3 py-2 text-sm text-taurus-text"
    >
      <span aria-hidden>✓</span>
      <span>{children}</span>
    </p>
  );
}

/** A larger error surface (used by route error boundaries). */
export function Alert({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-taurus-strong bg-taurus-surface px-6 py-10 text-center"
    >
      <h2 className="text-base font-semibold text-taurus-text">{title}</h2>
      {children ? <div className="mt-2 text-sm text-taurus-sub">{children}</div> : null}
    </div>
  );
}

/** Polished empty state with an optional action. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-taurus-strong bg-taurus-surface px-6 py-16 text-center",
      )}
    >
      <div
        aria-hidden
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-taurus-line bg-taurus-elevated text-taurus-sub"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-taurus-sub" />
      </div>
      <p className="max-w-md text-base text-taurus-text">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-taurus-faint">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
