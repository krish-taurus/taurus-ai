"use client";

/**
 * New connection flow (Sprint 014).
 *
 * Consolidated entry point: pick which AI Employee to attach and which
 * connection type, then continue to that AI Employee's existing setup page —
 * where the real (already-built, already-tested) configuration happens. This
 * adds no new provider logic; it is pure navigation.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses, Field, FieldError, Select } from "@/components/ui";
import { connectionSetupHref, connectionTypeLabel } from "@/modules/channels/connections";
import type { ChannelType } from "@/lib/db/types";

export function NewConnectionForm({
  employees,
  types,
  defaultType,
}: {
  employees: { id: string; name: string }[];
  types: ChannelType[];
  defaultType?: ChannelType;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [type, setType] = useState<ChannelType>(
    defaultType && types.includes(defaultType) ? defaultType : (types[0] ?? "website_widget"),
  );
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId) {
      setError("Choose which AI Employee this connection belongs to.");
      return;
    }
    router.push(connectionSetupHref(employeeId, type));
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field
        label="AI Employee"
        htmlFor="employeeId"
        hint="The connection is attached to this AI Employee."
      >
        <Select
          id="employeeId"
          name="employeeId"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          required
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Connection type" htmlFor="type">
        <Select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as ChannelType)}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {connectionTypeLabel(t)}
            </option>
          ))}
        </Select>
      </Field>

      {error ? <FieldError>{error}</FieldError> : null}

      <button type="submit" className={buttonClasses("primary", "lg", "w-full")}>
        Continue to setup
      </button>
    </form>
  );
}
