import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { formatDate } from "@/lib/format";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  EXTRACTION_STATUS_LABELS,
  humanFileSize,
  KNOWLEDGE_VISIBILITY_LABELS,
  PDF_DOCX_PROCESSING_MESSAGE,
  WEBSITE_RECORD_MESSAGE,
} from "@/modules/knowledge/metadata";
import { KnowledgeStatusBadge, KnowledgeTypeBadge } from "@/components/knowledge/knowledge-badges";
import { KnowledgeSourceActions } from "@/components/knowledge/knowledge-source-actions";
import { Badge, Card } from "@/components/ui";

export default async function KnowledgeSourceDetailPage({
  params,
}: {
  params: { sourceId: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.view")) {
    redirect("/dashboard");
  }

  const store = getStore();
  // Organization-scoped read: a source from another organization returns null.
  const source = await store.getKnowledgeSource(organization.id, params.sourceId);
  if (!source) notFound();

  const canManage = hasPermission(membership.role, "knowledge.manage");
  const documents = await store.listKnowledgeDocumentsForSource(organization.id, source.id);
  const assignedEmployees = await store.listEmployeesForKnowledgeSource(organization.id, source.id);
  const url = typeof source.metadata?.url === "string" ? source.metadata.url : null;

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link
          href="/dashboard/knowledge"
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Knowledge Vault
        </Link>
      </p>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-taurus-text">
              {source.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <KnowledgeTypeBadge sourceType={source.sourceType} />
              <KnowledgeStatusBadge status={source.status} />
              <Badge tone="outline">{KNOWLEDGE_VISIBILITY_LABELS[source.visibility]}</Badge>
            </div>
          </div>
        </div>

        {source.description ? (
          <p className="mt-5 border-t border-taurus-line pt-5 text-sm text-taurus-sub">
            {source.description}
          </p>
        ) : null}

        {canManage ? (
          <div className="mt-6 border-t border-taurus-line pt-5">
            <KnowledgeSourceActions source={source} />
          </div>
        ) : null}
      </Card>

      {/* Website record — the address is stored but never fetched this sprint. */}
      {source.sourceType === "url" ? (
        <Card className="mt-6 p-5">
          <h2 className="text-sm font-semibold text-taurus-text">Website</h2>
          {url ? (
            <p className="mt-2 break-all text-sm text-taurus-sub">{url}</p>
          ) : (
            <p className="mt-2 text-sm text-taurus-faint">No address recorded.</p>
          )}
          <p className="mt-3 text-xs text-taurus-faint">{WEBSITE_RECORD_MESSAGE}</p>
        </Card>
      ) : null}

      {/* Documents (text notes and uploaded files). */}
      {documents.length > 0 ? (
        <div className="mt-6 space-y-4">
          {documents.map((document) => (
            <Card key={document.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-taurus-text">{document.title}</h2>
                {document.storageKey ? (
                  <Link
                    href={`/dashboard/knowledge/${source.id}/documents/${document.id}/download`}
                    className="text-sm font-medium text-taurus-text hover:underline"
                  >
                    Download
                  </Link>
                ) : null}
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-taurus-faint">
                {document.contentType ? (
                  <div>
                    <dt className="inline">Type: </dt>
                    <dd className="inline text-taurus-sub">{document.contentType}</dd>
                  </div>
                ) : null}
                {document.byteSize ? (
                  <div>
                    <dt className="inline">Size: </dt>
                    <dd className="inline text-taurus-sub">{humanFileSize(document.byteSize)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="inline">Text: </dt>
                  <dd className="inline text-taurus-sub">
                    {EXTRACTION_STATUS_LABELS[document.extractionStatus]}
                  </dd>
                </div>
              </dl>

              {document.textPreview ? (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-taurus-faint">
                    Preview
                  </p>
                  {/* React escapes this text — uploaded content is never rendered as HTML. */}
                  <p className="whitespace-pre-wrap rounded-lg border border-taurus-line bg-taurus-elevated p-3 text-sm text-taurus-sub">
                    {document.textPreview}
                  </p>
                </div>
              ) : document.extractionStatus === "unsupported" ? (
                <p className="mt-4 rounded-lg border border-taurus-line bg-taurus-elevated p-3 text-sm text-taurus-sub">
                  {PDF_DOCX_PROCESSING_MESSAGE}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {/* Assigned AI Employees. */}
      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-taurus-text">Used by AI Employees</h2>
        {assignedEmployees.length === 0 ? (
          <p className="mt-2 text-sm text-taurus-faint">
            No AI Employees are using this yet. Assign it from an AI Employee&apos;s Knowledge page.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {assignedEmployees.map((employee) => (
              <li key={employee.id}>
                <Link
                  href={`/dashboard/employees/${employee.id}/knowledge`}
                  className="inline-flex items-center rounded-full border border-taurus-line px-3 py-1 text-sm text-taurus-sub hover:border-taurus-strong hover:text-taurus-text"
                >
                  {employee.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-xs text-taurus-faint">
        Added {formatDate(source.createdAt)} · Last updated {formatDate(source.updatedAt)}
      </p>
    </div>
  );
}
