import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";

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
    <div className="mx-auto max-w-2xl text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
        ✓
      </div>
      <h1 className="mt-5 text-2xl font-semibold text-slate-900">
        Your AI Employee has been hired.
      </h1>
      <p className="mt-2 text-slate-600">
        {employee.name} — {employee.roleTitle} has joined {organization.name}.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="rounded-md bg-taurus-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
        >
          View Employee profile
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Go to dashboard
        </Link>
      </div>

      <div className="mt-10 text-left">
        <h2 className="text-sm font-semibold text-slate-900">Suggested next steps</h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NEXT_STEPS.map((step) =>
            step.live ? (
              <li key={step.title}>
                <Link
                  href={`/dashboard/employees/${employee.id}/dna`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-taurus-accent hover:bg-taurus-accent/5"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-800">{step.title}</p>
                    <span className="text-sm font-medium text-taurus-accent">Start →</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{step.hint}</p>
                </Link>
              </li>
            ) : (
              <li
                key={step.title}
                className="cursor-not-allowed rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-700">{step.title}</p>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                    Coming soon
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{step.hint}</p>
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
