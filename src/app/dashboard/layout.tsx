import Link from "next/link";
import { DashboardNav } from "@/components/dashboard-nav";
import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { requireCurrentOrganization } from "@/lib/security/guards";
import {
  OrganizationProvider,
  type OrganizationContextValue,
  type OrganizationSummary,
} from "@/modules/organizations/organization-context";
import { ROLE_LABELS } from "@/modules/organizations/roles";
import { Badge, buttonClasses } from "@/components/ui";

/**
 * Dashboard shell (Prompt 002; restyled Sprint 005B).
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
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-taurus-line bg-taurus-surface px-4 py-5 sm:flex">
          <Link
            href="/dashboard"
            className="mb-8 flex items-center gap-2 px-2 text-sm font-semibold tracking-[0.16em] text-taurus-text"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-taurus-primary text-xs font-bold text-taurus-onPrimary">
              T
            </span>
            TAURUS AI
          </Link>

          <DashboardNav />

          <div className="mt-auto px-2 pt-6">
            <Link href="/dashboard/hire" className={buttonClasses("primary", "md", "w-full")}>
              Hire AI Employee
            </Link>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-taurus-line bg-taurus-app/80 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <DashboardMobileNav />
              <OrganizationSwitcher />
              <Badge tone="outline">{ROLE_LABELS[membership.role]}</Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-taurus-faint sm:inline">{user.email}</span>
              <SignOutButton />
            </div>
          </header>

          <main className="flex-1 px-6 py-8">
            <div className="animate-fade-in">{children}</div>
          </main>
        </div>
      </div>
    </OrganizationProvider>
  );
}
