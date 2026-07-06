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

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { localKnowledgeStorage } from "@/modules/knowledge/storage";
import {
  archiveSource,
  assignKnowledgeToEmployee,
  createFileSource,
  createTextSource,
  createUrlSource,
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

  let sourceId: string;
  try {
    const source = await createUrlSource(getStore(), ctx.actor, {
      name: formData.get("name"),
      description: formData.get("description") ?? undefined,
      visibility: formData.get("visibility") ?? undefined,
      url: formData.get("url"),
    });
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
    const source = await createFileSource(getStore(), localKnowledgeStorage, ctx.actor, {
      meta: {
        name: formData.get("name"),
        description: formData.get("description") ?? undefined,
        visibility: formData.get("visibility") ?? undefined,
      },
      file: { originalFilename: file.name, contentType: file.type || null, bytes },
    });
    sourceId = source.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not upload this file." };
  }

  revalidatePath("/dashboard/knowledge");
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

export async function archiveSourceAction(formData: FormData): Promise<void> {
  const sourceId = String(formData.get("sourceId") ?? "");
  const ctx = await requireManage();
  if (!ctx.ok) redirect(`/dashboard/knowledge/${sourceId}`);

  try {
    await archiveSource(getStore(), ctx.actor, sourceId);
  } catch {
    // Ignore and redirect to the list below.
  }

  revalidatePath("/dashboard/knowledge");
  redirect("/dashboard/knowledge");
}

export async function assignKnowledgeAction(formData: FormData): Promise<void> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const knowledgeSourceId = String(formData.get("knowledgeSourceId") ?? "");
  const ctx = await requireManage();
  if (!ctx.ok) redirect(`/dashboard/employees/${employeeId}/knowledge`);

  try {
    await assignKnowledgeToEmployee(getStore(), ctx.actor, { employeeId, knowledgeSourceId });
  } catch {
    // Ignore and re-render current state.
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath(`/dashboard/employees/${employeeId}/knowledge`);
  redirect(`/dashboard/employees/${employeeId}/knowledge`);
}

export async function unassignKnowledgeAction(formData: FormData): Promise<void> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const knowledgeSourceId = String(formData.get("knowledgeSourceId") ?? "");
  const ctx = await requireManage();
  if (!ctx.ok) redirect(`/dashboard/employees/${employeeId}/knowledge`);

  try {
    await unassignKnowledgeFromEmployee(getStore(), ctx.actor, { employeeId, knowledgeSourceId });
  } catch {
    // Ignore and re-render current state.
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath(`/dashboard/employees/${employeeId}/knowledge`);
  redirect(`/dashboard/employees/${employeeId}/knowledge`);
}
