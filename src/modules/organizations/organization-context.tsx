"use client";

/**
 * Organization context provider (Prompt 002).
 *
 * Organization isolation is mandatory. Every protected view runs inside exactly
 * one organization. The dashboard layout (a server component) resolves the
 * current organization + the user's role from the authenticated session and
 * feeds it here, so client components can read tenant identity without guessing.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { Role } from "@/modules/organizations/roles";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface OrganizationContextValue {
  /** The currently selected organization, or null outside an organization. */
  organization: OrganizationSummary | null;
  /** The current user's role in the selected organization. */
  role: Role | null;
  /** All organizations the user belongs to (for switching). */
  organizations: OrganizationSummary[];
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: OrganizationContextValue;
}) {
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

/** Read the current organization context. Throws if used outside the provider. */
export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (ctx === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider.");
  }
  return ctx;
}
