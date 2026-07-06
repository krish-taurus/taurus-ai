import { PageHeader } from "@/components/page-header";

export default function AuditPage() {
  return (
    <div>
      <PageHeader
        title="Audit"
        description="A record of important actions taken across your organization."
      />

      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="mx-auto max-w-md text-base text-slate-700">
          No audit events yet. Major actions in your organization will be recorded here.
        </p>
      </div>
    </div>
  );
}
