import Link from "next/link";
import { DashboardNav } from "@/components/dashboard-nav";
import { OrganizationProvider } from "@/modules/organizations/organization-context";

/**
 * Dashboard shell (Prompt 001).
 *
 * Wraps every dashboard route in the Organization context provider and renders
 * the persistent navigation shell. A real build resolves the organization from
 * the authenticated session (Prompt 002); here we pass a placeholder org so the
 * UI has something to display.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const placeholderOrganization = { id: "org_placeholder", name: "Your Organization" };

  return (
    <OrganizationProvider organization={placeholderOrganization}>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 sm:block">
          <Link href="/dashboard" className="mb-6 block px-3 text-lg font-bold text-slate-900">
            Taurus AI
          </Link>
          <DashboardNav />
        </aside>
        <div className="flex-1">
          <header className="border-b border-slate-200 bg-white px-6 py-3">
            <p className="text-sm text-slate-600">{placeholderOrganization.name}</p>
          </header>
          <main className="px-6 py-8">{children}</main>
        </div>
      </div>
    </OrganizationProvider>
  );
}
