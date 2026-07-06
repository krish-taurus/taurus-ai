/**
 * Hiring Studio stepper (Prompt 004; restyled Sprint 005B).
 *
 * Pure, presentational component (no state, no server deps) so it is easy to
 * unit-test. Shows the ordered steps, the current one, and completed ones, with
 * connector lines that fill as the user progresses. Doubles as the design
 * system's Stepper primitive.
 */

import { cn } from "@/components/ui";

export interface HiringStep {
  key: string;
  label: string;
}

export function HiringStepper({
  steps,
  currentStep,
}: {
  steps: readonly HiringStep[];
  /** 1-based index of the active step. */
  currentStep: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-3" aria-label="Hiring progress">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCurrent = stepNumber === currentStep;
        const isComplete = stepNumber < currentStep;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300",
                isCurrent && "bg-taurus-primary text-taurus-onPrimary",
                isComplete && "border border-taurus-strong bg-taurus-elevated text-taurus-text",
                !isCurrent &&
                  !isComplete &&
                  "border border-taurus-line bg-taurus-muted text-taurus-faint",
              )}
            >
              {isComplete ? "✓" : stepNumber}
            </span>
            <span
              className={cn(
                "text-sm font-medium transition-colors duration-300",
                isCurrent ? "text-taurus-text" : "text-taurus-faint",
              )}
            >
              {step.label}
            </span>
            {stepNumber < steps.length ? (
              <span
                aria-hidden
                className={cn(
                  "mx-1 hidden h-px w-8 transition-colors duration-300 sm:inline-block",
                  isComplete ? "bg-taurus-strong" : "bg-taurus-line",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
