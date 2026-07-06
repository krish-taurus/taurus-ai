import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireUser } from "@/lib/security/guards";

/**
 * Onboarding (Prompt 002; restyled 005B) — protected.
 *
 * The signed-in user names their organization. Creating it makes them the owner
 * and drops them into the organization-scoped dashboard.
 */
export default async function OnboardingPage() {
  const user = await requireUser();

  return (
    <AuthShell
      title="Set up your organization"
      subtitle={`Welcome, ${user.fullName ?? user.email}. Name your organization to get started — you will be its owner.`}
    >
      <CreateOrganizationForm />
    </AuthShell>
  );
}
