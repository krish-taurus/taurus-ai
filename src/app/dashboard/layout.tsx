import Link from "next/link";
import { DashboardNav } from "@/components/dashboard-nav";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { requireCurrentOrganization } from "@/lib/security/guards";
import {
  OrganizationProvider,
  type OrganizationContextValue,
  type OrganizationSummary,
} from "@/modules/organizations/organization-context";
import { ROLE_LABELS } from "@/modules/organizations/roles";

/**
 * Dashboard shell (Prompt 002).
 *
 * Protected: resolves the authenticated user and their selected organization
 * (redirecting to /login or /onboarding as needed), then provides organization
 * context to all dashboard client components. Every dashboard route is scoped to
 * this single organization.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, organization, membership, organizations } = await requireCurrentOrganization();

  const toSummary = (org: { id: string; name: string; slug: string }): OrganizationSummary => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
  });

  const contextValue: OrganizationContextValue = {
    organization: toSummary(organization),
    role: membership.role,
    organizations: organizations.map((view) => toSummary(view.organization)),
  };

  return (
    <OrganizationProvider value={contextValue}>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 sm:block">
          <Link href="/dashboard" className="mb-6 block px-3 text-lg font-bold text-slate-900">
            Taurus AI
          </Link>
          <DashboardNav />
        </aside>
        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <div className="flex items-center gap-3">
              <OrganizationSwitcher />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {ROLE_LABELS[membership.role]}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-600 sm:inline">{user.email}</span>
              <SignOutButton />
            </div>
          </header>
          <main className="px-6 py-8">{children}</main>
        </div>
      </div>
    </OrganizationProvider>
  );
}
