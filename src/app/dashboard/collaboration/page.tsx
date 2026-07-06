import { PageHeader } from "@/components/page-header";

export default function CollaborationPage() {
  return (
    <div>
      <PageHeader
        title="Collaboration"
        description="Controlled collaboration requests between your AI employees."
      />

      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="mx-auto max-w-md text-base text-slate-700">
          There are no collaboration requests yet. Once you have hired AI employees, they can work
          together on shared responsibilities here.
        </p>
      </div>
    </div>
  );
}
