"use client";

/**
 * Mobile dashboard navigation.
 *
 * The sidebar is desktop-only, so on phones the app had no navigation at all.
 * This renders a menu button in the header (mobile only) that opens the same
 * NAV_ITEMS in an animated slide-down sheet, plus the primary hire action. The
 * menu closes on navigation. Motion respects the global reduced-motion rule.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_GROUPS, NavLink } from "@/components/dashboard-nav";
import { buttonClasses, cn } from "@/components/ui";

export function DashboardMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the sheet whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-taurus-line text-taurus-text"
      >
        <span className="relative block h-3 w-4" aria-hidden>
          <span
            className={cn(
              "absolute left-0 top-0 h-0.5 w-4 rounded bg-taurus-text transition-transform duration-300 ease-taurus",
              open && "translate-y-[5px] rotate-45",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-[5px] h-0.5 w-4 rounded bg-taurus-text transition-opacity duration-300",
              open && "opacity-0",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-[10px] h-0.5 w-4 rounded bg-taurus-text transition-transform duration-300 ease-taurus",
              open && "-translate-y-[5px] -rotate-45",
            )}
          />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-x-0 top-[57px] z-30 max-h-[calc(100vh-57px)] overflow-y-auto border-b border-taurus-line bg-taurus-app/95 px-4 py-3 backdrop-blur">
          <nav aria-label="Dashboard" className="flex flex-col gap-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-0.5">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-taurus-faint">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-3 border-t border-taurus-line pt-3">
            <Link href="/dashboard/hire" className={buttonClasses("primary", "md", "w-full")}>
              Hire AI Employee
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
