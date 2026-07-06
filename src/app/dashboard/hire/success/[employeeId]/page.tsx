import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { buttonClasses } from "@/components/ui";

/**
 * Suggested next steps. "Add Employee DNA" is live (Prompt 005); the rest are
 * placeholders that arrive in later prompts.
 */
const NEXT_STEPS: readonly { title: string; hint: string; live?: boolean }[] = [
  {
    title: "Add Employee DNA",
    hint: "Define working style, responsibilities, and boundaries.",
    live: true,
  },
  { title: "Add Knowledge Vault", hint: "Give your AI Employee approved company knowledge." },
  { title: "Test Chat", hint: "Try a conversation before going live." },
  { title: "Configure Voice", hint: "Let your AI Employee answer calls." },
];

export default async function HireSuccessPage({ params }: { params: { employeeId: string } }) {
  const { organization } = await requireCurrentOrganization();
  // Organization-scoped read: an employee from another organization returns null.
  const employee = await getStore().getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  return (
    <div className="mx-auto max-w-2xl animate-fade-up text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-taurus-strong bg-taurus-elevated text-2xl text-taurus-text shadow-taurus-lift">
        ✓
      </div>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.16em] text-taurus-faint">
        Welcome to the team
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-taurus-text">
        Your AI Employee has been hired.
      </h1>
      <p className="mt-3 text-taurus-sub">
        {employee.name} — {employee.roleTitle} has joined {organization.name}.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className={buttonClasses("primary", "lg")}
        >
          View Employee profile
        </Link>
        <Link href="/dashboard" className={buttonClasses("secondary", "lg")}>
          Go to dashboard
        </Link>
      </div>

      <div className="mt-10 text-left">
        <h2 className="text-sm font-semibold text-taurus-text">Suggested next steps</h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NEXT_STEPS.map((step) =>
            step.live ? (
              <li key={step.title}>
                <Link
                  href={`/dashboard/employees/${employee.id}/dna`}
                  className="block rounded-lg border border-taurus-line bg-taurus-surface p-4 transition-colors hover:border-taurus-strong hover:bg-taurus-primary/[0.06]"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-taurus-text">{step.title}</p>
                    <span className="text-sm font-medium text-taurus-text">Start →</span>
                  </div>
                  <p className="mt-1 text-sm text-taurus-faint">{step.hint}</p>
                </Link>
              </li>
            ) : (
              <li
                key={step.title}
                className="cursor-not-allowed rounded-lg border border-dashed border-taurus-line bg-taurus-app p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-taurus-sub">{step.title}</p>
                  <span className="rounded-full bg-taurus-muted px-2 py-0.5 text-xs font-medium text-taurus-faint">
                    Coming soon
                  </span>
                </div>
                <p className="mt-1 text-sm text-taurus-faint">{step.hint}</p>
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
