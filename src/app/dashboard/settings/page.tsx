import { EmptyState, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your organization, members, and workspace preferences."
      />
      <EmptyState
        title="Settings are coming soon."
        description="Organization and member management arrive in a later step."
      />
    </div>
  );
}
