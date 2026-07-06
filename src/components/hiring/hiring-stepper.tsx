/**
 * Hiring Studio progress indicator (Prompt 004).
 *
 * Pure, presentational component (no state, no server deps) so it is easy to
 * unit-test. Shows the ordered steps and highlights the current one.
 */

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
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Hiring progress">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCurrent = stepNumber === currentStep;
        const isComplete = stepNumber < currentStep;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                isCurrent
                  ? "bg-taurus-accent text-white"
                  : isComplete
                    ? "bg-taurus-accent/15 text-taurus-accent"
                    : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              {isComplete ? "✓" : stepNumber}
            </span>
            <span
              className={[
                "text-sm font-medium",
                isCurrent ? "text-slate-900" : "text-slate-500",
              ].join(" ")}
            >
              {step.label}
            </span>
            {stepNumber < steps.length ? (
              <span aria-hidden className="mx-1 hidden h-px w-6 bg-slate-200 sm:inline-block" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
