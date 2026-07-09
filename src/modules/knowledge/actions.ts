"use server";

/**
 * Knowledge Vault server actions (Prompt 006).
 *
 * SECURITY: authentication + organization are resolved server-side via
 * requireCurrentOrganization(); organizationId is never taken from the client.
 * Every action re-checks the knowledge.manage permission. Website URLs are stored
 * but never fetched (no SSRF). Uploaded files go through the local storage
 * adapter and are never served publicly.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { localKnowledgeStorage } from "@/modules/knowledge/storage";
import { extractUploadedFileText, fetchWebsiteText } from "@/modules/knowledge/extraction";
import { runDatabaseQuery } from "@/modules/knowledge/connectors/database";
import {
  decodePendingConnection,
  ingestDriveSource,
  parseDriveId,
  refreshAccessToken,
  PENDING_COOKIE,
} from "@/modules/knowledge/connectors/google-drive";
import {
  createDatabaseSourceSchema,
  createGoogleDriveSourceSchema,
} from "@/modules/knowledge/schema";
import {
  isEncryptionConfigured,
  encryptApiKey,
  decryptApiKey,
} from "@/modules/model-gateway/credentials";
import {
  archiveSource,
  assignKnowledgeToEmployee,
  createDatabaseSource,
  createFileSource,
  createGoogleDriveSource,
  createTextSource,
  createUrlSource,
  syncDatabaseSource,
  syncGoogleDriveSource,
  unassignKnowledgeFromEmployee,
  updateSourceMetadata,
  type KnowledgeActor,
} from "@/modules/knowledge/service";

export interface KnowledgeActionState {
  error?: string;
}

/** Resolve org + user and require the knowledge.manage permission. */
async function requireManage(): Promise<{ ok: true; actor: KnowledgeActor } | { ok: false }> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.manage")) {
    return { ok: false };
  }
  return { ok: true, actor: { organizationId: organization.id, userId: user.id } };
}

const DENIED = "You do not have permission to manage the Knowledge Vault in this organization.";

export async function createTextSourceAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  let sourceId: string;
  try {
    const source = await createTextSource(getStore(), ctx.actor, {
      name: formData.get("name"),
      description: formData.get("description") ?? undefined,
      visibility: formData.get("visibility") ?? undefined,
      text: formData.get("text"),
    });
    sourceId = source.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save this knowledge." };
  }

  revalidatePath("/dashboard/knowledge");
  redirect(`/dashboard/knowledge/${sourceId}`);
}

export async function createUrlSourceAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  const rawUrl = String(formData.get("url") ?? "");
  let sourceId: string;
  try {
    // Fetch + extract the page text (SSRF-guarded) before saving.
    const fetched = await fetchWebsiteText(rawUrl);
    const source = await createUrlSource(
      getStore(),
      ctx.actor,
      {
        name: formData.get("name"),
        description: formData.get("description") ?? undefined,
        visibility: formData.get("visibility") ?? undefined,
        url: formData.get("url"),
      },
      { text: fetched.text, status: fetched.status },
    );
    sourceId = source.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save this website." };
  }

  revalidatePath("/dashboard/knowledge");
  redirect(`/dashboard/knowledge/${sourceId}`);
}

export async function createFileSourceAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file to upload." };
  }

  let sourceId: string;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Extract the document's text (PDF/DOCX/text) so it can be indexed + answered.
    const extraction = await extractUploadedFileText(file.name, bytes);
    const source = await createFileSource(getStore(), localKnowledgeStorage, ctx.actor, {
      meta: {
        name: formData.get("name"),
        description: formData.get("description") ?? undefined,
        visibility: formData.get("visibility") ?? undefined,
      },
      file: { originalFilename: file.name, contentType: file.type || null, bytes },
      extraction: { text: extraction.text, status: extraction.status },
    });
    sourceId = source.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not upload this file." };
  }

  revalidatePath("/dashboard/knowledge");
  redirect(`/dashboard/knowledge/${sourceId}`);
}

export async function createDatabaseSourceAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  if (!isEncryptionConfigured()) {
    return { error: "Secure storage is not configured, so database connectors are disabled." };
  }

  const parsed = createDatabaseSourceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    visibility: formData.get("visibility") ?? undefined,
    kind: formData.get("kind"),
    connectionString: formData.get("connectionString"),
    query: formData.get("query"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please review the connection details." };
  }
  const values = parsed.data;

  let sourceId: string;
  try {
    // Run the read-only query (server-only, SSRF-guarded) and encrypt the secret.
    const result = await runDatabaseQuery({
      kind: values.kind,
      connectionString: values.connectionString,
      query: values.query,
    });
    const connectionEncrypted = await encryptApiKey(values.connectionString);
    const displayHost = new URL(values.connectionString).host;
    const source = await createDatabaseSource(getStore(), ctx.actor, {
      meta: { name: values.name, description: values.description, visibility: values.visibility },
      connector: { kind: values.kind, displayHost, query: values.query, connectionEncrypted },
      result: { text: result.text, status: result.status, rowCount: result.rowCount },
    });
    sourceId = source.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not connect to the database." };
  }

  revalidatePath("/dashboard/knowledge");
  redirect(`/dashboard/knowledge/${sourceId}`);
}

export async function syncDatabaseSourceAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  const sourceId = String(formData.get("sourceId") ?? "");

  try {
    const store = getStore();
    const source = await store.getKnowledgeSource(ctx.actor.organizationId, sourceId);
    if (!source || source.sourceType !== "database") {
      return { error: "This database source could not be found." };
    }
    const meta = source.metadata as {
      kind?: "postgres" | "mysql";
      query?: string;
      connectionEncrypted?: string;
    };
    if (!meta.connectionEncrypted || !meta.query) {
      return { error: "This source is missing its connection details." };
    }
    const connectionString = await decryptApiKey(meta.connectionEncrypted);
    const result = await runDatabaseQuery({
      kind: meta.kind ?? "postgres",
      connectionString,
      query: meta.query,
    });
    await syncDatabaseSource(store, ctx.actor, sourceId, {
      text: result.text,
      status: result.status,
      rowCount: result.rowCount,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not sync the database." };
  }

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${sourceId}`);
  redirect(`/dashboard/knowledge/${sourceId}`);
}

export async function createGoogleDriveSourceAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  if (!isEncryptionConfigured()) {
    return { error: "Secure storage is not configured, so connectors are disabled." };
  }

  // The just-connected account is carried in an encrypted, httpOnly cookie.
  const pending = await decodePendingConnection(cookies().get(PENDING_COOKIE)?.value);
  if (!pending) {
    return { error: "The Google Drive connection expired. Please connect the account again." };
  }

  const parsed = createGoogleDriveSourceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    visibility: formData.get("visibility") ?? undefined,
    link: formData.get("link"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please review the details." };
  }
  const values = parsed.data;

  const rootId = parseDriveId(values.link);
  if (!rootId) {
    return { error: "That doesn't look like a Google Drive file or folder link." };
  }

  let sourceId: string;
  try {
    const accessToken = await refreshAccessToken(pending.refreshToken);
    const ingest = await ingestDriveSource({ accessToken, rootId });
    if (ingest.documents.length === 0) {
      return {
        error:
          "No supported files were found there. Add PDFs, Word, text, or Google Docs/Sheets/Slides.",
      };
    }
    const connectionEncrypted = await encryptApiKey(pending.refreshToken);
    const source = await createGoogleDriveSource(getStore(), ctx.actor, {
      meta: { name: values.name, description: values.description, visibility: values.visibility },
      connector: {
        email: pending.email,
        rootId,
        rootName: ingest.rootName,
        connectionEncrypted,
      },
      documents: ingest.documents,
      skipped: ingest.skipped,
    });
    sourceId = source.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not import from Google Drive." };
  }

  // The connection is now stored on the source; clear the short-lived handoff.
  cookies().delete(PENDING_COOKIE);
  revalidatePath("/dashboard/knowledge");
  redirect(`/dashboard/knowledge/${sourceId}`);
}

export async function syncGoogleDriveSourceAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  const sourceId = String(formData.get("sourceId") ?? "");

  try {
    const store = getStore();
    const source = await store.getKnowledgeSource(ctx.actor.organizationId, sourceId);
    if (!source || source.sourceType !== "google_drive") {
      return { error: "This Google Drive source could not be found." };
    }
    const meta = source.metadata as { rootId?: string; connectionEncrypted?: string };
    if (!meta.connectionEncrypted || !meta.rootId) {
      return { error: "This source is missing its connection details. Please reconnect it." };
    }
    const refreshToken = await decryptApiKey(meta.connectionEncrypted);
    const accessToken = await refreshAccessToken(refreshToken);
    const ingest = await ingestDriveSource({ accessToken, rootId: meta.rootId });
    await syncGoogleDriveSource(store, ctx.actor, sourceId, {
      documents: ingest.documents,
      skipped: ingest.skipped,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not sync from Google Drive." };
  }

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${sourceId}`);
  redirect(`/dashboard/knowledge/${sourceId}`);
}

export async function updateSourceAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  const sourceId = String(formData.get("sourceId") ?? "");

  try {
    await updateSourceMetadata(getStore(), ctx.actor, sourceId, {
      name: formData.get("name"),
      description: formData.get("description") ?? undefined,
      visibility: formData.get("visibility"),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update this knowledge." };
  }

  revalidatePath("/dashboard/knowledge");
  revalidatePath(`/dashboard/knowledge/${sourceId}`);
  redirect(`/dashboard/knowledge/${sourceId}`);
}

export async function archiveSourceAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const sourceId = String(formData.get("sourceId") ?? "");
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  try {
    await archiveSource(getStore(), ctx.actor, sourceId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not archive this knowledge." };
  }

  revalidatePath("/dashboard/knowledge");
  redirect("/dashboard/knowledge");
}

export async function assignKnowledgeAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const knowledgeSourceId = String(formData.get("knowledgeSourceId") ?? "");
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  try {
    await assignKnowledgeToEmployee(getStore(), ctx.actor, { employeeId, knowledgeSourceId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not assign this knowledge." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath(`/dashboard/employees/${employeeId}/knowledge`);
  redirect(`/dashboard/employees/${employeeId}/knowledge`);
}

export async function unassignKnowledgeAction(
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const knowledgeSourceId = String(formData.get("knowledgeSourceId") ?? "");
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  try {
    await unassignKnowledgeFromEmployee(getStore(), ctx.actor, { employeeId, knowledgeSourceId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not remove this knowledge." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath(`/dashboard/employees/${employeeId}/knowledge`);
  redirect(`/dashboard/employees/${employeeId}/knowledge`);
}
