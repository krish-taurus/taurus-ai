"use client";

/**
 * Performance Review forms (Sprint 018). Client components wrapping the server
 * actions. Copy stays in the AI Employee metaphor — no eval / rubric / prompt.
 */

import { useFormState, useFormStatus } from "react-dom";
import {
  addCriterionAction,
  addReviewCaseAction,
  createScorecardAction,
  startReviewRunAction,
  type PerformanceActionState,
} from "@/modules/performance/actions";
import { GRADING_METHODS, type GradingMethod } from "@/modules/performance/types";
import { FieldError } from "@/components/ui";

const initial: PerformanceActionState = {};

const METHOD_LABELS: Record<GradingMethod, string> = {
  contains: "Includes text (free)",
  exact: "Exact match (free)",
  regex: "Matches a pattern (free)",
  no_refusal: "Doesn't refuse (free)",
  reviewer: "Reviewed by an AI Employee",
  grounded: "Reviewed for grounded answer",
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-taurus-primary px-4 py-2 text-sm font-medium text-taurus-onPrimary disabled:opacity-50"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-taurus-line bg-transparent px-3 py-2 text-sm";

export function NewScorecardForm() {
  const [state, action] = useFormState(createScorecardAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-medium text-taurus-text">Scorecard name</label>
        <input name="name" required className={inputClass} placeholder="Support quality" />
      </div>
      <div>
        <label className="text-sm font-medium text-taurus-text">Description (optional)</label>
        <input name="description" className={inputClass} placeholder="What this scorecard measures" />
      </div>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
      <div>
        <Submit label="Create scorecard" />
      </div>
    </form>
  );
}

export function AddCriterionForm({ scorecardId, position }: { scorecardId: string; position: number }) {
  const [state, action] = useFormState(addCriterionAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="scorecardId" value={scorecardId} />
      <input type="hidden" name="position" value={position} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-taurus-text">Criterion</label>
          <input name="label" required className={inputClass} placeholder="Cites the refund window" />
        </div>
        <div>
          <label className="text-sm font-medium text-taurus-text">How it&apos;s graded</label>
          <select name="method" className={inputClass} defaultValue="contains">
            {GRADING_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-taurus-text">What good looks like</label>
        <input name="guidance" required className={inputClass} placeholder="Mentions the 30-day window" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-taurus-text">Expected text / pattern</label>
          <input name="expected" className={inputClass} placeholder="For the free methods" />
        </div>
        <div>
          <label className="text-sm font-medium text-taurus-text">Weight</label>
          <input name="weight" type="number" min="1" step="1" defaultValue="1" className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium text-taurus-text">Pass threshold (0–1)</label>
          <input name="passThreshold" type="number" min="0" max="1" step="0.1" defaultValue="0.7" className={inputClass} />
        </div>
      </div>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
      <div>
        <Submit label="Add criterion" />
      </div>
    </form>
  );
}

export function AddCaseForm({ scorecardId }: { scorecardId: string }) {
  const [state, action] = useFormState(addReviewCaseAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="scorecardId" value={scorecardId} />
      <div>
        <label className="text-sm font-medium text-taurus-text">Case name</label>
        <input name="name" required className={inputClass} placeholder="Refund question" />
      </div>
      <div>
        <label className="text-sm font-medium text-taurus-text">The situation</label>
        <textarea name="situation" required rows={3} className={inputClass} placeholder="A customer asks how refunds work." />
      </div>
      <div>
        <label className="text-sm font-medium text-taurus-text">What a good answer covers (optional)</label>
        <textarea name="expected" rows={2} className={inputClass} placeholder="Explains the 30-day refund window." />
      </div>
      {state.error ? <FieldError>{state.error}</FieldError> : null}
      <div>
        <Submit label="Add case" />
      </div>
    </form>
  );
}

export function RunReviewForm({
  scorecardId,
  employees,
  fixedEmployeeId,
}: {
  scorecardId: string;
  employees: { id: string; name: string }[];
  fixedEmployeeId?: string;
}) {
  const [state, action] = useFormState(startReviewRunAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="scorecardId" value={scorecardId} />
      {fixedEmployeeId ? (
        <input type="hidden" name="employeeId" value={fixedEmployeeId} />
      ) : (
        <div>
          <label className="text-sm font-medium text-taurus-text">AI Employee</label>
          <select name="employeeId" className={inputClass} required defaultValue="">
            <option value="" disabled>
              Choose an AI Employee
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <Submit label="Run review" />
      {state.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
