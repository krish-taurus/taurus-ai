import Link from "next/link";
import { buttonClasses, Container, PageShell } from "@/components/ui";

const CAPABILITIES: { title: string; body: string; soon?: boolean }[] = [
  {
    title: "Hire AI Employees",
    body: "Bring on an AI Employee for a role in minutes through a calm, guided Hiring Studio — no technical setup.",
  },
  {
    title: "Define Employee DNA",
    body: "Shape each AI Employee's working style, responsibilities, and boundaries like an employee handbook.",
  },
  {
    title: "Add Knowledge Vault",
    body: "Give your AI Employees approved company knowledge so they answer from what matters.",
    soon: true,
  },
  {
    title: "Collaborate across AI Workforces",
    body: "Let AI Employees work together across your organization on shared responsibilities.",
    soon: true,
  },
];

export default function HomePage() {
  return (
    <PageShell>
      {/* Top bar */}
      <header className="border-b border-taurus-line/70">
        <Container className="flex items-center justify-between px-6 py-5">
          <span className="text-sm font-semibold tracking-[0.18em] text-taurus-text">
            TAURUS<span className="text-taurus-faint"> AI</span>
          </span>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonClasses("ghost", "sm")}>
              Sign in
            </Link>
            <Link href="/signup" className={buttonClasses("primary", "sm")}>
              Get started
            </Link>
          </div>
        </Container>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[420px] bg-[radial-gradient(600px_240px_at_50%_0%,rgba(255,255,255,0.06),transparent_70%)]"
        />
        <Container className="px-6 py-24 text-center sm:py-32">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-taurus-line bg-taurus-surface px-3 py-1 text-xs font-medium text-taurus-sub">
            <span className="h-1.5 w-1.5 rounded-full bg-taurus-text" />
            Enterprise AI workforce platform
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-taurus-text sm:text-6xl">
            The operating system for AI Employees.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-taurus-sub">
            Hire, shape, and manage a premium AI workforce. Calm, powerful, and built for the
            enterprise from day one.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className={buttonClasses("primary", "lg")}>
              Hire your first AI Employee
            </Link>
            <Link href="/login" className={buttonClasses("secondary", "lg")}>
              Explore the platform
            </Link>
          </div>
        </Container>
      </section>

      {/* Capabilities */}
      <section className="border-t border-taurus-line/70">
        <Container className="px-6 py-20">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CAPABILITIES.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-taurus-line bg-taurus-surface p-7 transition-colors duration-300 ease-taurus hover:border-taurus-strong"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-taurus-text">{item.title}</h2>
                  {item.soon ? (
                    <span className="rounded-full border border-taurus-line px-2 py-0.5 text-xs font-medium text-taurus-faint">
                      Coming soon
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-taurus-sub">{item.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-taurus-line/70">
        <Container className="px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-taurus-text">
            Build your AI workforce today.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-taurus-sub">
            It takes five minutes to hire your first AI Employee.
          </p>
          <div className="mt-7">
            <Link href="/signup" className={buttonClasses("primary", "lg")}>
              Hire your first AI Employee
            </Link>
          </div>
        </Container>
      </section>

      <footer className="border-t border-taurus-line/70">
        <Container className="px-6 py-8">
          <p className="text-xs text-taurus-faint">
            Taurus AI — the operating system for AI Employees.
          </p>
        </Container>
      </footer>
    </PageShell>
  );
}
