"use server";

/**
 * Organization server actions (Prompt 002).
 *
 * createOrganization: creates an organization owned by the current user (via the
 * service, which also writes the audit event), selects it, and enters the
 * dashboard.
 *
 * switchOrganization: changes the selected organization, validating membership
 * first so a user can never select an organization they do not belong to.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { ORG_COOKIE } from "@/lib/security/guards";
import { requireUser } from "@/lib/security/guards";
import { resolveMembership } from "@/lib/security/tenancy";
import {
  createOrganizationForUser,
  createOrganizationSchema,
} from "@/modules/organizations/service";

export interface OrganizationActionState {
  error?: string;
}

function setOrganizationCookie(organizationId: string): void {
  cookies().set({
    name: ORG_COOKIE,
    value: organizationId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function createOrganization(
  _prevState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const user = await requireUser();

  const parsed = createOrganizationSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid organization name." };
  }

  let organizationId: string;
  try {
    const { organization } = await createOrganizationForUser(getStore(), user.id, parsed.data);
    organizationId = organization.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create organization." };
  }

  setOrganizationCookie(organizationId);
  redirect("/dashboard");
}

export async function switchOrganization(formData: FormData): Promise<void> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");

  // Validate membership before honoring the switch — never trust the client.
  try {
    await resolveMembership(getStore(), user.id, organizationId);
  } catch {
    redirect("/dashboard");
  }

  setOrganizationCookie(organizationId);
  redirect("/dashboard");
}
