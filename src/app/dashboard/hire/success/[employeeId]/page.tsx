import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { buttonClasses } from "@/components/ui";

/**
 * Suggested next steps in the onboarding path. Each links to the AI Employee's
 * relevant setup page (`path` is appended to `/dashboard/employees/{id}`). The
 * destination pages each enforce their own permission checks server-side.
 */
const NEXT_STEPS: readonly { title: string; hint: string; path: string }[] = [
  {
    title: "Add Employee DNA",
    hint: "Define working style, responsibilities, and boundaries.",
    path: "/dna",
  },
  {
    title: "Add Knowledge Vault",
    hint: "Give your AI Employee approved company knowledge.",
    path: "/knowledge",
  },
  { title: "Test Chat", hint: "Try a conversation before going live.", path: "/chat" },
  { title: "Configure Voice", hint: "Let your AI Employee answer calls.", path: "/channels/voice" },
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

      <p className="mt-4 text-sm text-taurus-sub">
        Try a conversation to see {employee.name} in action — then deploy across your channels.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/dashboard/employees/${employee.id}/chat`}
          className={buttonClasses("primary", "lg")}
        >
          Test {employee.name} in chat
        </Link>
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className={buttonClasses("secondary", "lg")}
        >
          View Employee profile
        </Link>
      </div>

      <div className="mt-10 text-left">
        <h2 className="text-sm font-semibold text-taurus-text">Suggested next steps</h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NEXT_STEPS.map((step) => (
            <li key={step.title}>
              <Link
                href={`/dashboard/employees/${employee.id}${step.path}`}
                className="block rounded-lg border border-taurus-line bg-taurus-surface p-4 transition-colors hover:border-taurus-strong hover:bg-taurus-primary/[0.06]"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-taurus-text">{step.title}</p>
                  <span className="text-sm font-medium text-taurus-text">Start →</span>
                </div>
                <p className="mt-1 text-sm text-taurus-faint">{step.hint}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
