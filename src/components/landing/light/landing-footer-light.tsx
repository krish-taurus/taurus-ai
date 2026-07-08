/**
 * Light landing footer (Sprint 020). Server component — no motion needed.
 */

import Link from "next/link";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Use cases", href: "#use-cases" },
      { label: "Channels", href: "#channels" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Employee DNA", href: "#how-it-works" },
      { label: "Knowledge Vault", href: "#how-it-works" },
      { label: "Model Hub", href: "#model-hub" },
      { label: "Performance Review", href: "#performance" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Create account", href: "/signup" },
      { label: "Sign in", href: "/login" },
    ],
  },
];

export function LandingFooterLight() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <p className="text-sm font-semibold tracking-[0.22em] text-neutral-900">
              TAURUS<span className="text-neutral-400"> AI</span>
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
              The operating system for AI Employees. Hire, train, deploy, and manage AI Employees
              across your business.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) =>
                  link.href.startsWith("/") ? (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-neutral-500 transition-colors duration-200 hover:text-neutral-900"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-neutral-500 transition-colors duration-200 hover:text-neutral-900"
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
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-neutral-400">
            © {new Date().getFullYear()} Taurus AI. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs text-neutral-400 transition-colors hover:text-neutral-900"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg border border-neutral-300 px-3.5 py-1.5 text-xs font-medium text-neutral-900 transition-colors hover:border-neutral-900"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
