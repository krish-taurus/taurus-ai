/**
 * AI Employee metadata (Prompt 003).
 *
 * Status/visibility values and their user-facing labels, plus the Hiring Studio
 * templates offered when creating an employee. Labels use plain, non-technical
 * Taurus language — no tenant/security or AI-implementation jargon in the UI.
 */

import type { EmployeeStatus, EmployeeVisibility } from "@/lib/db/types";

export const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = [
  "draft",
  "training",
  "active",
  "paused",
  "archived",
] as const;

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  draft: "Draft",
  training: "Training",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export const EMPLOYEE_VISIBILITIES: readonly EmployeeVisibility[] = [
  "private",
  "organization",
  "network_ready",
] as const;

export const EMPLOYEE_VISIBILITY_LABELS: Record<EmployeeVisibility, string> = {
  private: "Private",
  organization: "Organization",
  network_ready: "Network ready",
};

export const EMPLOYEE_VISIBILITY_HINTS: Record<EmployeeVisibility, string> = {
  private: "Only you and admins can see this AI Employee.",
  organization: "Everyone in your organization can see this AI Employee.",
  network_ready: "Prepared to collaborate beyond your organization in the future.",
};

export function isEmployeeStatus(value: unknown): value is EmployeeStatus {
  return typeof value === "string" && (EMPLOYEE_STATUSES as readonly string[]).includes(value);
}

export function isEmployeeVisibility(value: unknown): value is EmployeeVisibility {
  return typeof value === "string" && (EMPLOYEE_VISIBILITIES as readonly string[]).includes(value);
}

/**
 * Hiring Studio templates. Each is a starting point that pre-fills a suggested
 * role title and department. `custom` starts blank. These are presentation-only
 * for now; deeper behavior (Employee DNA) arrives in a later prompt.
 */
export interface EmployeeTemplate {
  key: string;
  label: string;
  suggestedRoleTitle: string;
  suggestedDepartment: string;
  description: string;
}

export const EMPLOYEE_TEMPLATES: readonly EmployeeTemplate[] = [
  {
    key: "receptionist",
    label: "Receptionist",
    suggestedRoleTitle: "AI Receptionist",
    suggestedDepartment: "Front Office",
    description: "Greets people and routes requests to the right place.",
  },
  {
    key: "customer_support",
    label: "Customer Support",
    suggestedRoleTitle: "Customer Support AI",
    suggestedDepartment: "Support",
    description: "Answers customer questions and helps resolve issues.",
  },
  {
    key: "sales_assistant",
    label: "Sales Assistant",
    suggestedRoleTitle: "Sales Assistant AI",
    suggestedDepartment: "Sales",
    description: "Helps qualify leads and answer product questions.",
  },
  {
    key: "hr_assistant",
    label: "HR Assistant",
    suggestedRoleTitle: "HR Assistant AI",
    suggestedDepartment: "People",
    description: "Answers common HR and policy questions.",
  },
  {
    key: "internal_knowledge_assistant",
    label: "Internal Knowledge Assistant",
    suggestedRoleTitle: "Internal Knowledge AI",
    suggestedDepartment: "Operations",
    description: "Helps your team find approved internal knowledge.",
  },
  {
    key: "recruiting_assistant",
    label: "Recruiting Assistant",
    suggestedRoleTitle: "Recruiting Assistant AI",
    suggestedDepartment: "Talent",
    description: "Supports hiring workflows and candidate questions.",
  },
  {
    key: "operations_assistant",
    label: "Operations Assistant",
    suggestedRoleTitle: "Operations Assistant AI",
    suggestedDepartment: "Operations",
    description: "Helps coordinate routine operational tasks.",
  },
  {
    key: "custom",
    label: "Custom Employee",
    suggestedRoleTitle: "",
    suggestedDepartment: "",
    description: "Start from scratch and define the role yourself.",
  },
] as const;

export const EMPLOYEE_TEMPLATE_KEYS = EMPLOYEE_TEMPLATES.map((t) => t.key);

export function getTemplate(key: string): EmployeeTemplate | undefined {
  return EMPLOYEE_TEMPLATES.find((t) => t.key === key);
}
