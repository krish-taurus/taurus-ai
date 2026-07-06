/**
 * Authenticated, organization-scoped document download (Prompt 006).
 *
 * Uploaded files are NEVER served publicly. This route resolves the current
 * organization from the session, confirms the document belongs to it, reads the
 * bytes from local storage, and forces a download (never inline HTML rendering).
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { localKnowledgeStorage } from "@/modules/knowledge/storage";

export async function GET(
  _request: Request,
  { params }: { params: { sourceId: string; documentId: string } },
) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.view")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const store = getStore();
  const document = await store.getKnowledgeDocument(organization.id, params.documentId);
  // Organization scope + belongs-to-source check; anything else is "not found".
  if (!document || document.knowledgeSourceId !== params.sourceId || !document.storageKey) {
    return new NextResponse("Not found", { status: 404 });
  }

  let bytes: Uint8Array;
  try {
    bytes = await localKnowledgeStorage.read(organization.id, document.storageKey);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  // Safe ASCII filename for the header; force download and disable sniffing so
  // uploaded HTML/scripts are never rendered by the browser.
  const safeName = (document.originalFilename || "document").replace(/[^a-zA-Z0-9._-]+/g, "_");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
