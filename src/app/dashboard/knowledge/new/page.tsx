import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  CreateKnowledgeForms,
  type GoogleDriveConnectState,
} from "@/components/knowledge/create-knowledge-forms";
import {
  decodePendingConnection,
  isGoogleDriveConfigured,
  PENDING_COOKIE,
} from "@/modules/knowledge/connectors/google-drive";
import { Card, PageHeader } from "@/components/ui";

/** Friendly copy for a failed Google Drive connect attempt. */
const DRIVE_ERRORS: Record<string, string> = {
  denied: "Google sign-in was cancelled. Please try connecting again.",
  state: "That sign-in link expired. Please connect again.",
  unavailable: "Google Drive isn’t available right now. Please try again later.",
  norefresh: "Google didn’t return offline access. Please connect again and allow access.",
  exchange: "We couldn’t complete the Google connection. Please try again.",
};

export default async function NewKnowledgePage({
  searchParams,
}: {
  searchParams?: { connect?: string; connected?: string; error?: string };
}) {
  const { membership } = await requireCurrentOrganization();
  // Least privilege: only roles that can manage the vault may add knowledge.
  if (!hasPermission(membership.role, "knowledge.manage")) {
    redirect("/dashboard/knowledge");
  }

  const onDriveTab = searchParams?.connect === "google-drive";
  const pending = onDriveTab
    ? await decodePendingConnection(cookies().get(PENDING_COOKIE)?.value)
    : null;

  const googleDrive: GoogleDriveConnectState = {
    configured: isGoogleDriveConfigured(),
    connected: !!pending,
    email: pending?.email ?? null,
    errorMessage: searchParams?.error ? (DRIVE_ERRORS[searchParams.error] ?? null) : null,
  };

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm">
        <Link
          href="/dashboard/knowledge"
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Back to Knowledge Vault
        </Link>
      </p>

      <PageHeader
        eyebrow="Knowledge Vault"
        title="Add Knowledge"
        description="Add a note, upload a document, save a website, or connect a data source for your AI Employees."
      />

      <Card className="p-6 sm:p-8">
        <CreateKnowledgeForms
          defaultTab={onDriveTab ? "google_drive" : "text"}
          googleDrive={googleDrive}
        />
      </Card>
    </div>
  );
}
