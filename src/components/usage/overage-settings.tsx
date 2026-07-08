"use client";

/**
 * Overage settings (Sprint 017). Owner/admin only (enforced server-side). Lets a
 * MANAGED org enable pay-as-you-go past its quota and set an optional monthly
 * spend cap. Discloses the rate and that charges are in addition to the plan —
 * no surprise bills. BYOK orgs are told this does not apply to them.
 */

import { useFormState, useFormStatus } from "react-dom";
import { updateOverageSettingsAction } from "@/modules/billing/actions";
import type { OverageSummary } from "@/modules/billing/overage";
import { Card, FieldError } from "@/components/ui";

const initialState: { error?: string } = {};

function usd(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-taurus-primary px-4 py-2 text-sm font-medium text-taurus-onPrimary disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save overage settings"}
    </button>
  );
}

export function OverageSettings({
  overage,
  canManage,
}: {
  overage: OverageSummary;
  canManage: boolean;
}) {
  const [state, formAction] = useFormState(updateOverageSettingsAction, initialState);

  if (!overage.eligible) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-taurus-text">Past your limit</h3>
        <p className="mt-2 text-sm text-taurus-sub">
          Pay as you go isn&apos;t used with your own model keys — you pay your provider directly.
          Interactions are paused at your plan limit until the next period or an upgrade.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-taurus-text">Past your limit</h3>
      <p className="mt-1 text-sm text-taurus-sub">
        Choose what happens when you reach your monthly interaction limit.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label className="flex items-start gap-3">
          <input
            type="radio"
            name="overagePolicy"
            value="hard_cap"
            defaultChecked={overage.policy === "hard_cap"}
            disabled={!canManage}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-medium text-taurus-text">Stop at my limit</span>{" "}
            <span className="text-taurus-sub">— interactions pause until you upgrade. No extra charges.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="radio"
            name="overagePolicy"
            value="pay_as_you_go"
            defaultChecked={overage.policy === "pay_as_you_go"}
            disabled={!canManage}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-medium text-taurus-text">Pay as you go</span>{" "}
            <span className="text-taurus-sub">
              — keep working past your limit at {usd(overage.unitPriceUsd)} per interaction,{" "}
              <strong>in addition to your plan</strong>.
            </span>
          </span>
        </label>

        <div className="mt-2">
          <label htmlFor="overageSpendCapUsd" className="block text-sm font-medium text-taurus-text">
            Monthly spend cap (optional)
          </label>
          <p className="text-xs text-taurus-faint">
            Caps your overage bill. When reached, interactions pause for the rest of the period.
            Leave blank for no cap.
          </p>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-sm text-taurus-sub">$</span>
            <input
              id="overageSpendCapUsd"
              name="overageSpendCapUsd"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              defaultValue={overage.spendCapUsd ?? ""}
              disabled={!canManage}
              placeholder="No cap"
              className="w-32 rounded-lg border border-taurus-line bg-transparent px-2 py-1 text-sm"
            />
          </div>
        </div>

        {overage.simulated ? (
          <p className="text-xs text-taurus-faint">
            Simulated billing is on — overage is tracked and shown but never charged.
          </p>
        ) : null}

        {state.error ? <FieldError>{state.error}</FieldError> : null}

        {canManage ? (
          <div>
            <SaveButton disabled={!canManage} />
          </div>
        ) : (
          <p className="text-xs text-taurus-faint">Only owners and admins can change this.</p>
        )}
      </form>
    </Card>
  );
}
