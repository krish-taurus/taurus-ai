"use client";

/**
 * Model access mode toggle (Sprint 016). Owner/admin only (enforced server-side
 * in the action). Managed = runs on Taurus keys (budget + standard models);
 * BYOK = runs on the org's own key and unlocks premium models.
 */

import { useFormState, useFormStatus } from "react-dom";
import { updateModelAccessModeAction } from "@/modules/model-gateway/actions";
import type { ModelAccessMode } from "@/lib/db/types";
import { Card, FieldError } from "@/components/ui";

const initialState: { error?: string } = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-taurus-primary px-4 py-2 text-sm font-medium text-taurus-onPrimary disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save access mode"}
    </button>
  );
}

export function AccessModeToggle({
  current,
  canManage,
}: {
  current: ModelAccessMode;
  canManage: boolean;
}) {
  const [state, formAction] = useFormState(updateModelAccessModeAction, initialState);

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-taurus-text">Model access mode</h3>
      <p className="mt-1 text-sm text-taurus-sub">
        How your AI Employees&apos; interactions are served and billed.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label className="flex items-start gap-3">
          <input
            type="radio"
            name="modelAccessMode"
            value="managed"
            defaultChecked={current === "managed"}
            disabled={!canManage}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-medium text-taurus-text">Managed</span>{" "}
            <span className="text-taurus-sub">
              — runs on Taurus keys, no setup. Budget and Standard models only.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="radio"
            name="modelAccessMode"
            value="byok"
            defaultChecked={current === "byok"}
            disabled={!canManage}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-medium text-taurus-text">Bring your own key</span>{" "}
            <span className="text-taurus-sub">
              — runs on your provider key. Unlocks Premium models.
            </span>
          </span>
        </label>

        {state.error ? <FieldError>{state.error}</FieldError> : null}

        {canManage ? (
          <div>
            <SubmitButton disabled={!canManage} />
          </div>
        ) : (
          <p className="text-xs text-taurus-faint">Only owners and admins can change this.</p>
        )}
      </form>
    </Card>
  );
}
