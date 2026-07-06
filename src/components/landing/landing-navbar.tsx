"use client";

/**
 * Landing navbar (Premium Landing v2).
 *
 * Sticky, glassy, monochrome. Anchor links into the page story, sign-in, and the
 * primary hire CTA. Collapses into a clean full-width menu on mobile.
 */

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Platform", href: "#platform" },
  { label: "Channels", href: "#channels" },
  { label: "Pricing", href: "#pricing" },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled || open
          ? "border-b border-white/10 bg-[#030303]/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8"
      >
        <Link
          href="/"
          className="text-sm font-semibold tracking-[0.22em] text-taurus-text"
          aria-label="Taurus AI home"
        >
          TAURUS<span className="text-taurus-faint"> AI</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-taurus-sub transition-colors duration-200 hover:text-taurus-text"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-taurus-sub transition-colors duration-200 hover:text-taurus-text"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="group rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#050505] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
          >
            Hire your first AI Employee
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 md:hidden"
        >
          <span className="relative block h-3 w-4" aria-hidden>
            <span
              className={`absolute left-0 top-0 h-px w-4 bg-taurus-text transition-transform duration-300 ${open ? "translate-y-[6px] rotate-45" : ""}`}
            />
            <span
              className={`absolute left-0 top-[6px] h-px w-4 bg-taurus-text transition-opacity duration-300 ${open ? "opacity-0" : ""}`}
            />
            <span
              className={`absolute left-0 top-[12px] h-px w-4 bg-taurus-text transition-transform duration-300 ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
            />
          </span>
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/10 md:hidden"
          >
            <div className="space-y-1 px-5 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm text-taurus-sub hover:bg-white/5 hover:text-taurus-text"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-3">
                <Link
                  href="/login"
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-center text-sm font-medium text-taurus-text"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#050505]"
                >
                  Hire your first AI Employee
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
