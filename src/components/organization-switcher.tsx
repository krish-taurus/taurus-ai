"use client";

/**
 * Organization switcher (Prompt 002).
 *
 * Lets a user who belongs to multiple organizations change the selected one.
 * Submits to the switchOrganization server action, which re-validates membership
 * before honoring the change. Hidden when the user has only one organization.
 */

import { useRef } from "react";
import { switchOrganization } from "@/modules/organizations/actions";
import { useOrganization } from "@/modules/organizations/organization-context";

export function OrganizationSwitcher() {
  const { organization, organizations } = useOrganization();
  const formRef = useRef<HTMLFormElement>(null);

  if (!organization || organizations.length < 2) {
    return (
      <span className="text-sm font-semibold tracking-tight text-taurus-text">
        {organization?.name}
      </span>
    );
  }

  return (
    <form ref={formRef} action={switchOrganization}>
      <label htmlFor="organizationId" className="sr-only">
        Select organization
      </label>
      <select
        id="organizationId"
        name="organizationId"
        defaultValue={organization.id}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-taurus-line bg-taurus-elevated px-2.5 py-1.5 text-sm font-semibold text-taurus-text transition-colors hover:border-taurus-strong focus:border-taurus-strong focus:outline-none"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </form>
  );
}
