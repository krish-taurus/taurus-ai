/**
 * Landing footer (Premium Landing v2). Server component — no motion needed.
 */

import Link from "next/link";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "AI Employees", href: "#product" },
      { label: "Channels", href: "#channels" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Employee DNA", href: "#platform" },
      { label: "Knowledge Vault", href: "#platform" },
      { label: "Model Hub", href: "#platform" },
      { label: "Unified Inbox", href: "#platform" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Get started", href: "/signup" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Taurus", href: "#top" },
      { label: "The workforce network", href: "#top" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#030303]">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <p className="text-sm font-semibold tracking-[0.22em] text-taurus-text">
              TAURUS<span className="text-taurus-faint"> AI</span>
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-taurus-faint">
              The operating system for AI Employees. Hire, train, deploy, and manage AI Employees
              across your business.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-taurus-faint">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) =>
                  link.href.startsWith("/") ? (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-taurus-sub transition-colors duration-200 hover:text-taurus-text"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-taurus-sub transition-colors duration-200 hover:text-taurus-text"
                      >
                        {link.label}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-taurus-faint">
            © {new Date().getFullYear()} Taurus AI. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs text-taurus-faint transition-colors hover:text-taurus-text"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg border border-white/12 px-3.5 py-1.5 text-xs font-medium text-taurus-text transition-colors hover:border-white/30"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
