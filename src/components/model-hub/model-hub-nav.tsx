"use client";

/**
 * Model Hub sub-navigation.
 *
 * A small tab bar tying the Model Hub pages together (Overview, Configure,
 * Providers, Catalog) so a user can move between them — e.g. save a key on
 * Providers and step back to Overview — without hunting for a lone "Back"
 * button. Rendered under the page header on every Model Hub page.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string }[] = [
  { href: "/dashboard/settings/models", label: "Overview" },
  { href: "/dashboard/settings/models/configure", label: "Configure" },
  { href: "/dashboard/settings/models/providers", label: "Providers" },
  { href: "/dashboard/settings/models/catalog", label: "Catalog" },
];

export function ModelHubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Model Hub"
      className="mb-6 flex flex-wrap gap-1 border-b border-taurus-line"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/dashboard/settings/models"
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-200 ease-taurus ${
              active
                ? "border-taurus-text text-taurus-text"
                : "border-transparent text-taurus-sub hover:text-taurus-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
