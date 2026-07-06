import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your organization, members, and workspace preferences."
      />

      <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
        <p className="mx-auto max-w-md text-base text-slate-700">
          Settings are a placeholder in this foundation build. Organization and member management
          are added in a later step.
        </p>
      </div>
    </div>
  );
}
