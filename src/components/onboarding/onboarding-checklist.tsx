/**
 * Activation checklist (Sprint 020).
 *
 * Shown on the dashboard overview until the organization has its first AI
 * Employee live. Server component: step completion is derived data passed in, and
 * dismiss / resume are server actions. Role-respecting — a step the current role
 * cannot perform shows its progress but no call-to-action. Returns nothing once
 * the required steps are complete.
 */

import Link from "next/link";
import { buttonClasses, Card, Progress } from "@/components/ui";
import { dismissOnboardingAction, resumeOnboardingAction } from "@/modules/onboarding/actions";
import type { OnboardingState, OnboardingStepView } from "@/modules/onboarding/service";

function StepRow({ step }: { step: OnboardingStepView }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden
        className={
          step.done
            ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-taurus-primary text-xs font-semibold text-taurus-on-primary"
            : "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-taurus-strong text-xs text-taurus-faint"
        }
      >
        {step.done ? "✓" : ""}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={
              step.done
                ? "text-sm font-medium text-taurus-sub line-through"
                : "text-sm font-medium text-taurus-text"
            }
          >
            {step.title}
          </p>
          {step.optional ? (
            <span className="rounded-full border border-taurus-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-taurus-faint">
              Optional
            </span>
          ) : null}
        </div>
        {!step.done ? (
          <p className="mt-0.5 text-xs text-taurus-faint">{step.description}</p>
        ) : null}
      </div>
      {!step.done ? (
        step.canAct && step.href ? (
          <Link
            href={step.href}
            className="shrink-0 text-sm font-medium text-taurus-text hover:text-taurus-sub"
          >
            {step.actionLabel} →
          </Link>
        ) : (
          <span className="shrink-0 text-xs text-taurus-faint">Admin task</span>
        )
      ) : null}
    </li>
  );
}

export function OnboardingChecklist({ state }: { state: OnboardingState }) {
  // Nothing to show once the required steps are done.
  if (state.complete) return null;

  const percent = Math.round((state.requiredDone / state.requiredTotal) * 100);

  // Dismissed but not complete — a slim, resumable banner.
  if (state.dismissed) {
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-taurus-line bg-taurus-surface px-4 py-3">
        <p className="text-sm text-taurus-sub">
          Finish setting up Taurus — {state.requiredDone} of {state.requiredTotal} steps done.
        </p>
        <form action={resumeOnboardingAction}>
          <button type="submit" className="text-sm font-medium text-taurus-text hover:text-taurus-sub">
            Resume setup →
          </button>
        </form>
      </div>
    );
  }

  return (
    <Card className="mb-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-taurus-text">Get your first AI Employee live</h2>
          <p className="mt-1 text-sm text-taurus-sub">
            A few steps to hire, train, test, and deploy — you can come back anytime.
          </p>
        </div>
        <form action={dismissOnboardingAction}>
          <button type="submit" className="text-xs font-medium text-taurus-faint hover:text-taurus-sub">
            Dismiss
          </button>
        </form>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex-1">
          <Progress value={percent} />
        </div>
        <span className="text-xs tabular-nums text-taurus-faint">
          {state.requiredDone}/{state.requiredTotal}
        </span>
      </div>

      <ul className="mt-4 divide-y divide-taurus-line">
        {state.steps.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </ul>

      {state.firstEmployeeId === null ? (
        <div className="mt-5">
          <Link href="/dashboard/hire" className={buttonClasses("primary")}>
            Start with your first hire
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
