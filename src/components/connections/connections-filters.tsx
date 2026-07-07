"use client";

/**
 * Connections filters (Sprint 014).
 *
 * Filter the global connections list by AI Employee, connection type, and
 * status. State lives in the URL query so it is server-rendered and shareable;
 * changing a select navigates with the updated params.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";
import { CONNECTION_STATUS_LABELS, connectionTypeLabel } from "@/modules/channels/connections";
import type { ChannelStatus, ChannelType } from "@/lib/db/types";

const STATUSES: ChannelStatus[] = ["active", "paused", "draft", "archived"];

export function ConnectionsFilters({
  employees,
  types,
}: {
  employees: { id: string; name: string }[];
  types: ChannelType[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      role="group"
      aria-label="Filter connections"
    >
      <label className="space-y-1.5">
        <span className="block text-xs font-medium text-taurus-sub">AI Employee</span>
        <Select
          value={searchParams.get("employee") ?? ""}
          onChange={(e) => setParam("employee", e.target.value)}
        >
          <option value="">All AI Employees</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="space-y-1.5">
        <span className="block text-xs font-medium text-taurus-sub">Connection type</span>
        <Select
          value={searchParams.get("type") ?? ""}
          onChange={(e) => setParam("type", e.target.value)}
        >
          <option value="">All types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {connectionTypeLabel(type)}
            </option>
          ))}
        </Select>
      </label>

      <label className="space-y-1.5">
        <span className="block text-xs font-medium text-taurus-sub">Status</span>
        <Select
          value={searchParams.get("status") ?? ""}
          onChange={(e) => setParam("status", e.target.value)}
        >
          <option value="">Any status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {CONNECTION_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
