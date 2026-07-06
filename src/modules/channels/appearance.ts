/**
 * Channel appearance defaults + normalization (Prompt 008).
 */

import type { AiEmployee, ChannelAppearance } from "@/lib/db/types";

export function defaultAppearance(employee: AiEmployee): ChannelAppearance {
  return {
    theme: "dark",
    position: "bottom-right",
    launcherLabel: "Chat with us",
    employeeDisplayName: employee.name,
    accentStyle: "mono",
    showSources: true,
    collectVisitorEmail: false,
    brandName: null,
  };
}

/** Coerce arbitrary stored/parsed data into a valid appearance object. */
export function normalizeAppearance(raw: unknown, fallback: ChannelAppearance): ChannelAppearance {
  const a = (raw ?? {}) as Partial<ChannelAppearance>;
  return {
    theme: a.theme === "light" ? "light" : "dark",
    position: a.position === "bottom-left" ? "bottom-left" : "bottom-right",
    launcherLabel:
      typeof a.launcherLabel === "string" && a.launcherLabel.trim()
        ? a.launcherLabel.slice(0, 60)
        : fallback.launcherLabel,
    employeeDisplayName:
      typeof a.employeeDisplayName === "string" && a.employeeDisplayName.trim()
        ? a.employeeDisplayName.slice(0, 80)
        : fallback.employeeDisplayName,
    accentStyle: a.accentStyle === "solid" ? "solid" : "mono",
    showSources: a.showSources !== false,
    collectVisitorEmail: a.collectVisitorEmail === true,
    brandName:
      typeof a.brandName === "string" && a.brandName.trim() ? a.brandName.slice(0, 80) : null,
  };
}
