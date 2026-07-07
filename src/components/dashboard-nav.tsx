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

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/employees", label: "AI Employees" },
  { href: "/dashboard/hire", label: "Hiring Studio" },
  { href: "/dashboard/knowledge", label: "Knowledge Vault" },
  { href: "/dashboard/settings/models", label: "Model Hub" },
  { href: "/dashboard/connections", label: "Connections" },
  { href: "/dashboard/collaboration", label: "Collaboration" },
  { href: "/dashboard/audit", label: "Audit" },
  { href: "/dashboard/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
              active
                ? "bg-taurus-muted text-taurus-text"
                : "text-taurus-sub hover:bg-taurus-muted/60 hover:text-taurus-text",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
