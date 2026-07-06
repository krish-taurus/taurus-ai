import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import { requireUser } from "@/lib/security/guards";

/**
 * Onboarding (Prompt 002) — protected.
 *
 * The signed-in user names their organization. Creating it makes them the owner
 * and drops them into the organization-scoped dashboard.
 */
export default async function OnboardingPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Set up your organization</h1>
      <p className="mt-2 text-sm text-slate-600">
        Welcome, {user.fullName ?? user.email}. Name your organization to get started — you will be
        its owner.
      </p>

      <CreateOrganizationForm />
    </main>
  );
}
