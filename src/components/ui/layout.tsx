/**
 * Layout primitives (Sprint 005B): Container, PageShell, PageHeader,
 * SectionHeader. Provide consistent spacing and a subtle page fade-in.
 */

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** Centered max-width container. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl", className)}>{children}</div>;
}

/** Wraps a page's content and applies the subtle entrance fade. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("animate-fade-in", className)}>{children}</div>;
}

/** Primary page heading with optional description and trailing action slot. */
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-taurus-faint">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-taurus-text">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-taurus-sub">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/** Smaller heading for a section within a page. */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-taurus-text">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-taurus-faint">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
