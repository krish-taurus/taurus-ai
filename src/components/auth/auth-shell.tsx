/**
 * Auth shell (Sprint 005B) — a premium, centered card used by the sign-in,
 * sign-up, and onboarding pages.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold tracking-[0.18em] text-taurus-text"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-taurus-primary text-xs font-bold text-taurus-onPrimary">
            T
          </span>
          TAURUS AI
        </Link>

        <Card className="p-8">
          <h1 className="text-xl font-semibold tracking-tight text-taurus-text">{title}</h1>
          <p className="mt-2 text-sm text-taurus-sub">{subtitle}</p>
          {children}
        </Card>

        {footer ? <div className="mt-6 text-center text-sm text-taurus-sub">{footer}</div> : null}
      </div>
    </main>
  );
}
