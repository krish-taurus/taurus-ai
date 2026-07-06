import { PageHeader } from "@/components/page-header";

export default function HiringStudioPage() {
  return (
    <div>
      <PageHeader
        title="Hiring Studio"
        description="Hire a new AI employee in a few guided steps — no technical setup required."
      />

      <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
        <p className="mx-auto max-w-md text-base text-slate-700">
          The Hiring Studio is a placeholder in this foundation build. Here you will choose a role,
          shape your AI employee&apos;s Employee DNA, and connect its Knowledge Vault.
        </p>
      </div>
    </div>
  );
}
