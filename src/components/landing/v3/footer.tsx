/**
 * Landing v3 footer (Sprint 055) — server component, no motion needed.
 *
 * Four columns of real destinations (anchors into the story, the public
 * Marketplace, the auth routes and direct contact), the brand statement, and
 * the copyright line. No dead links: only pages and sections that exist.
 */

import Link from "next/link";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "AI Employees", href: "#use-cases" },
      { label: "How it works", href: "#how-it-works" },
      { label: "All features", href: "#features" },
      { label: "Security", href: "#security" },
      { label: "Performance", href: "#performance" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Sales", href: "#use-cases" },
      { label: "Customer support", href: "#use-cases" },
      { label: "Recruitment", href: "#use-cases" },
      { label: "Operations", href: "#use-cases" },
      { label: "Data analysis", href: "#use-cases" },
      { label: "Leadership", href: "#use-cases" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "AI Employee Marketplace", href: "/marketplace" },
      { label: "FAQ", href: "#faq" },
      { label: "Book a demo", href: "#contact" },
      { label: "Contact us", href: "#contact" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Create your account", href: "/signup" },
      { label: "Sign in", href: "/login" },
      { label: "Start free — no card", href: "/signup" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] text-neutral-950">
              TAURUS<span className="text-neutral-400"> AI</span>
            </p>
            <p className="mt-3 max-w-[220px] text-[13px] leading-relaxed text-neutral-500">
              The operating system for AI Employees.
            </p>
            <div className="mt-5 space-y-1 text-[13px] text-neutral-400">
              <p>
                <a href="tel:+916363402404" className="transition-colors hover:text-neutral-900">
                  +91 63634 02404
                </a>
              </p>
              <p>
                <a href="mailto:krishbhargav@thetaurus.ai" className="transition-colors hover:text-neutral-900">
                  krishbhargav@thetaurus.ai
                </a>
              </p>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.label}`}>
                    {link.href.startsWith("/") ? (
                      <Link href={link.href} className="text-[13px] text-neutral-600 transition-colors hover:text-neutral-950">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-[13px] text-neutral-600 transition-colors hover:text-neutral-950">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-neutral-100 pt-8 sm:flex-row">
          <p className="text-[12px] text-neutral-400">
            © {new Date().getFullYear()} Taurus AI. All rights reserved.
          </p>
          <p className="text-[12px] font-medium text-neutral-500">
            Taurus AI — The Operating System for AI Employees.
          </p>
        </div>
      </div>
    </footer>
  );
}
