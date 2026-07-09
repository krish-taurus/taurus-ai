import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  CreateKnowledgeForms,
  type GoogleDriveConnectState,
  type SharePointConnectState,
} from "@/components/knowledge/create-knowledge-forms";
import {
  decodePendingConnection,
  isGoogleDriveConfigured,
  PENDING_COOKIE,
} from "@/modules/knowledge/connectors/google-drive";
import {
  decodePendingConnection as decodeSharePointPending,
  isSharePointConfigured,
  PENDING_COOKIE as SHAREPOINT_PENDING_COOKIE,
} from "@/modules/knowledge/connectors/sharepoint";
import { Card, PageHeader } from "@/components/ui";

/** Friendly copy for a failed connect attempt (Google Drive / SharePoint). */
const DRIVE_ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled. Please try connecting again.",
  state: "That sign-in link expired. Please connect again.",
  unavailable: "This connector isn’t available right now. Please try again later.",
  norefresh: "The provider didn’t return offline access. Please connect again and allow access.",
  exchange: "We couldn’t complete the connection. Please try again.",
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

  const connect = searchParams?.connect;
  const onDriveTab = connect === "google-drive";
  const onSharePointTab = connect === "sharepoint";
  const errorMessage = searchParams?.error ? (DRIVE_ERRORS[searchParams.error] ?? null) : null;

  const drivePending = onDriveTab
    ? await decodePendingConnection(cookies().get(PENDING_COOKIE)?.value)
    : null;
  const googleDrive: GoogleDriveConnectState = {
    configured: isGoogleDriveConfigured(),
    connected: !!drivePending,
    email: drivePending?.email ?? null,
    errorMessage: onDriveTab ? errorMessage : null,
  };

  const spPending = onSharePointTab
    ? await decodeSharePointPending(cookies().get(SHAREPOINT_PENDING_COOKIE)?.value)
    : null;
  const sharePoint: SharePointConnectState = {
    configured: isSharePointConfigured(),
    connected: !!spPending,
    email: spPending?.email ?? null,
    errorMessage: onSharePointTab ? errorMessage : null,
  };

  const defaultTab = onDriveTab ? "google_drive" : onSharePointTab ? "sharepoint" : "text";

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
          defaultTab={defaultTab}
          googleDrive={googleDrive}
          sharePoint={sharePoint}
        />
      </Card>
    </div>
  );
}
