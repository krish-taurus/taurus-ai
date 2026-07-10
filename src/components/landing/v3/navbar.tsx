"use client";

/**
 * Landing v3 navbar (Sprint 055).
 *
 * Starts fully transparent over the hero, condenses into a floating frosted
 * glass bar once the page scrolls. Centre links anchor into the one-page story;
 * the primary CTA never leaves the viewport. On mobile the nav collapses to a
 * sheet and a floating bottom CTA appears after the hero so the conversion
 * path stays one thumb away.
 */

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Platform", href: "#platform" },
  { label: "AI Employees", href: "#use-cases" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      setPastHero(window.scrollY > window.innerHeight * 0.85);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5">
        <nav
          aria-label="Main"
          className={`flex h-14 w-full max-w-6xl items-center justify-between rounded-2xl px-4 transition-all duration-500 sm:px-5 ${
            scrolled || open
              ? "border border-neutral-200/80 bg-white/72 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
              : "border border-transparent bg-transparent"
          }`}
        >
          <Link
            href="/"
            className="text-sm font-semibold tracking-[0.24em] text-neutral-950"
            aria-label="Taurus AI home"
          >
            TAURUS<span className="text-neutral-400"> AI</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3.5 py-2 text-[13px] font-medium text-neutral-500 transition-colors duration-200 hover:bg-neutral-950/[0.04] hover:text-neutral-950"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-neutral-500 transition-colors duration-200 hover:text-neutral-950"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-neutral-950 px-5 py-2.5 text-[13px] font-semibold text-white transition-transform duration-200 hover:scale-[1.04] active:scale-[0.97]"
            >
              Build your first AI Employee
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
          >
            <span className="relative block h-3 w-4" aria-hidden>
              <span
                className={`absolute left-0 top-0 h-px w-4 bg-neutral-950 transition-transform duration-300 ${open ? "translate-y-[6px] rotate-45" : ""}`}
              />
              <span
                className={`absolute left-0 top-[6px] h-px w-4 bg-neutral-950 transition-opacity duration-300 ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`absolute left-0 top-[12px] h-px w-4 bg-neutral-950 transition-transform duration-300 ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
              />
            </span>
          </button>
        </nav>
      </header>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-3 top-[76px] z-50 rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur-2xl lg:hidden"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
              <Link
                href="/login"
                className="rounded-xl border border-neutral-200 px-4 py-3 text-center text-sm font-medium text-neutral-900"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-neutral-950 px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Build your first AI Employee
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Floating mobile CTA once past the hero */}
      <AnimatePresence>
        {pastHero && !open ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 bottom-4 z-40 lg:hidden"
          >
            <Link
              href="/signup"
              className="block rounded-full bg-neutral-950 px-6 py-4 text-center text-sm font-semibold text-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.45)]"
            >
              Build your first AI Employee
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
