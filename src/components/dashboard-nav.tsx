"use client";

/**
 * Dashboard sidebar navigation (Prompt 001; restyled Sprint 005B).
 *
 * Persistent sidebar links. Taurus terminology only — never "agent" or the raw
 * word for a prompt in the UI.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { NavIcon, type NavIconName } from "@/components/nav-icons";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Grouped for scanability — Workspace (daily work), Platform (config), Account. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: "overview" },
      { href: "/dashboard/employees", label: "AI Employees", icon: "employees" },
      { href: "/dashboard/hire", label: "Hiring Studio", icon: "hire" },
      { href: "/dashboard/marketplace", label: "Marketplace", icon: "marketplace" },
      { href: "/dashboard/knowledge", label: "Knowledge Vault", icon: "knowledge" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/dashboard/settings/models", label: "Model Hub", icon: "models" },
      { href: "/dashboard/connections", label: "Connections", icon: "connections" },
      { href: "/dashboard/performance", label: "Performance", icon: "performance" },
      { href: "/dashboard/collaboration", label: "Collaboration", icon: "collaboration" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/usage", label: "Usage", icon: "usage" },
      { href: "/dashboard/settings/billing", label: "Billing", icon: "billing" },
      { href: "/dashboard/audit", label: "Audit", icon: "audit" },
      { href: "/dashboard/settings", label: "Settings", icon: "settings" },
    ],
  },
];

/** Flat list (order preserved) for consumers that don't need grouping. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A single nav link — shared by the sidebar and the mobile menu. */
export function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ease-taurus",
        active
          ? "bg-taurus-muted text-taurus-text"
          : "text-taurus-sub hover:bg-taurus-muted/60 hover:text-taurus-text",
      )}
    >
      <NavIcon
        name={item.icon}
        className={cn("h-[18px] w-[18px]", active ? "text-taurus-text" : "text-taurus-faint")}
      />
      {item.label}
    </Link>
  );
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-taurus-faint">
            {group.label}
          </p>
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      ))}
    </nav>
  );
}
