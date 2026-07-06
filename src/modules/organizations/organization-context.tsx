"use client";

/**
 * Placeholder Organization context provider (Prompt 001).
 *
 * Organization isolation is mandatory in Taurus AI. Every tenant-scoped view
 * runs inside an organization. This client provider gives the UI a single place
 * to read "which organization am I acting as", so components never hard-code or
 * guess tenant identity. Real organization loading (from session + DB) is wired
 * up in Prompt 002.
 */

import { createContext, useContext, type ReactNode } from "react";

export interface Organization {
  id: string;
  name: string;
}

interface OrganizationContextValue {
  organization: Organization | null;
  /** True while an organization is being resolved (always false in Prompt 001). */
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({
  children,
  organization = null,
}: {
  children: ReactNode;
  organization?: Organization | null;
}) {
  // Placeholder value. Prompt 002 resolves this from the authenticated session.
  const value: OrganizationContextValue = {
    organization,
    isLoading: false,
  };

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
