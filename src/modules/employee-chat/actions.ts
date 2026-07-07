"use server";

/**
 * Employee Chat server actions (Prompt 007).
 *
 * SECURITY: authentication + organization are resolved server-side via
 * requireCurrentOrganization(); organizationId is never taken from the client.
 * Every action re-checks permissions and loads the employee organization-scoped
 * (cross-org employees return not found). Chat runs through the Model Gateway
 * only. No provider SDKs are imported here.
 */

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { createLlmGateway } from "@/modules/model-gateway/credential-resolver";
import { sendChatMessage, ChatBlockedError } from "@/modules/employee-chat/service";
import { EntitlementError } from "@/modules/billing/service";
import { rebuildKnowledgeRetrievalSegmentsForEmployee } from "@/modules/employee-chat/preparation";
import { chatMessageSchema } from "@/modules/employee-chat/schema";
import type { ChatBlockReason } from "@/modules/employee-chat/metadata";

export interface ChatActionState {
  error?: string;
  ok?: boolean;
}

const DENIED = "You do not have permission to use chat in this organization.";

const BLOCK_MESSAGES: Record<ChatBlockReason, string> = {
  needs_dna: "Publish Employee DNA before testing this AI Employee.",
  needs_model_hub: "Configure Model Hub before running this AI Employee.",
  archived: "This AI Employee is archived and cannot be chatted with.",
  no_model: "No Employee Brain is available yet. Check your Model Hub settings.",
};

export async function sendChatMessageAction(
  _prevState: ChatActionState,
  formData: FormData,
): Promise<ChatActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (
    !hasPermission(membership.role, "employee_chat.use") ||
    !hasPermission(membership.role, "employee.view")
  ) {
    return { error: DENIED };
  }

  const employeeId = String(formData.get("employeeId") ?? "");
  const store = getStore();
  const employee = await store.getEmployee(organization.id, employeeId);
  if (!employee) return { error: "This AI Employee could not be found." };

  const parsed = chatMessageSchema.safeParse({ message: formData.get("message") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please type a message." };
  }

  try {
    await sendChatMessage(
      { store, gateway: createLlmGateway(store) },
      {
        actor: { organizationId: organization.id, userId: user.id },
        organizationName: organization.name,
        employee,
        threadId: formData.get("threadId") ? String(formData.get("threadId")) : null,
        message: parsed.data.message,
      },
    );
  } catch (err) {
    if (err instanceof ChatBlockedError) return { error: BLOCK_MESSAGES[err.reason] };
    // Entitlement blocks carry a clear, upgrade-oriented message — surface it.
    if (err instanceof EntitlementError) return { error: err.message };
    return { error: "Sorry — your message could not be sent. Please try again." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}/chat`);
  return { ok: true };
}

export async function prepareEmployeeKnowledgeAction(
  _prevState: ChatActionState,
  formData: FormData,
): Promise<ChatActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee_chat.use")) return { error: DENIED };

  const employeeId = String(formData.get("employeeId") ?? "");
  const store = getStore();
  const employee = await store.getEmployee(organization.id, employeeId);
  if (!employee) return { error: "This AI Employee could not be found." };

  const result = await rebuildKnowledgeRetrievalSegmentsForEmployee(
    store,
    organization.id,
    employee.id,
  );

  await store.createAuditEvent({
    organizationId: organization.id,
    actorType: "user",
    actorId: user.id,
    action: "knowledge_retrieval.prepared",
    targetType: "employee",
    targetId: employee.id,
    metadata: {
      employeeId: employee.id,
      preparedSources: result.preparedSources,
      totalSegments: result.totalSegments,
    },
  });

  revalidatePath(`/dashboard/employees/${employeeId}/chat`);
  return { ok: true };
}

export async function archiveChatThreadAction(
  _prevState: ChatActionState,
  formData: FormData,
): Promise<ChatActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee_chat.use")) return { error: DENIED };

  const employeeId = String(formData.get("employeeId") ?? "");
  const threadId = String(formData.get("threadId") ?? "");
  const store = getStore();

  const thread = await store.archiveEmployeeChatThread(organization.id, threadId);
  if (thread) {
    await store.createAuditEvent({
      organizationId: organization.id,
      actorType: "user",
      actorId: user.id,
      action: "employee_chat.thread_archived",
      targetType: "employee_chat_thread",
      targetId: thread.id,
      metadata: { employeeId, threadId: thread.id },
    });
  }

  revalidatePath(`/dashboard/employees/${employeeId}/chat`);
  return { ok: true };
}
