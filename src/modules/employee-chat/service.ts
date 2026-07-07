/**
 * Employee Chat service (Prompt 007) — server only.
 *
 * Orchestrates one chat turn: verify readiness, retrieve grounded excerpts, build
 * the runtime context, call the MODEL GATEWAY ONLY, persist user + assistant
 * messages, record a retrieval event, and emit metadata-only audit events.
 *
 * The gateway is injected, so this module never imports a provider SDK and tests
 * run with a fake gateway (no external calls). Audit + retrieval events store
 * metadata only — never message contents, never model instructions.
 */

import type {
  AiEmployee,
  ChatSourceReference,
  EmployeeChatMessage,
  EmployeeChatThread,
  ProviderSlug,
} from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import type {
  GatewayRequest,
  GatewayResponse,
  ModelResolution,
} from "@/modules/model-gateway/types";
import { GatewayError } from "@/modules/model-gateway/gateway";
import {
  isLiveProviderConfigured as defaultIsLiveProviderConfigured,
  isProductionRuntime,
} from "@/modules/model-gateway/credential-resolver";
import { retrieveForEmployee, toSourceReferences } from "@/modules/employee-chat/retrieval";
import { buildRuntimeContext } from "@/modules/employee-chat/runtime-context";
import { FRIENDLY_ERROR_MESSAGE, type ChatBlockReason } from "@/modules/employee-chat/metadata";
import { assertWithinInteractionQuota } from "@/modules/billing/service";

/** The subset of the Model Gateway the chat service depends on. */
export interface ChatGateway {
  generateText(request: GatewayRequest): Promise<GatewayResponse>;
  resolveModelForTask(request: GatewayRequest): Promise<ModelResolution>;
}

export class ChatBlockedError extends Error {
  constructor(readonly reason: ChatBlockReason) {
    super(`Chat is not available: ${reason}`);
    this.name = "ChatBlockedError";
  }
}

export interface ChatActor {
  organizationId: string;
  /** Null for anonymous public-channel visitors. */
  userId: string | null;
  /** Defaults to "user"; public-channel turns use "system". */
  actorType?: "user" | "system";
}

export interface SendChatMessageParams {
  actor: ChatActor;
  organizationName: string;
  employee: AiEmployee;
  threadId?: string | null;
  message: string;
}

export interface ChatServiceDeps {
  store: DataStore;
  gateway: ChatGateway;
  isLiveProviderConfigured?: (
    store: DataStore,
    organizationId: string,
    providerSlug: ProviderSlug | null,
  ) => Promise<boolean>;
  isProduction?: () => boolean;
}

export interface SendChatMessageResult {
  thread: EmployeeChatThread;
  userMessage: EmployeeChatMessage;
  assistantMessage: EmployeeChatMessage;
  sources: ChatSourceReference[];
  brainMode: "live" | "local_demo";
  demo: boolean;
  status: "sent" | "failed";
}

/** Non-reversible short hash of the query (stored instead of the full question). */
function hashQuery(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function threadTitle(message: string): string {
  const words = message.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length > 60 ? `${words.slice(0, 60)}…` : words || "New conversation";
}

/** Send one message and generate the AI Employee's grounded reply. */
export async function sendChatMessage(
  deps: ChatServiceDeps,
  params: SendChatMessageParams,
): Promise<SendChatMessageResult> {
  const { store, gateway } = deps;
  const isLiveProviderConfigured = deps.isLiveProviderConfigured ?? defaultIsLiveProviderConfigured;
  const isProduction = deps.isProduction ?? isProductionRuntime;
  const { actor, employee, message, organizationName } = params;
  const orgId = actor.organizationId;
  const actorType = actor.actorType ?? "user";

  // --- Governance gates (re-checked server-side) ---------------------------
  if (employee.status === "archived") throw new ChatBlockedError("archived");

  const published = await store.getPublishedEmployeeDna(orgId, employee.id);
  if (!published) throw new ChatBlockedError("needs_dna");

  const resolution = await gateway.resolveModelForTask({
    organizationId: orgId,
    employeeId: employee.id,
    taskType: "employee_chat",
    messages: [],
  });
  if (!resolution.model || !resolution.providerSlug) throw new ChatBlockedError("no_model");

  const liveAvailable = await isLiveProviderConfigured(store, orgId, resolution.providerSlug);
  if (!liveAvailable && isProduction()) throw new ChatBlockedError("needs_model_hub");

  // --- Interaction quota gate (Prompt 011) ---------------------------------
  // A billable AI Employee interaction is about to happen. Re-check the plan's
  // monthly quota server-side BEFORE generating a reply. On a "block" plan this
  // throws an upgrade-oriented EntitlementError; a "soft_cap" plan passes.
  await assertWithinInteractionQuota(store, orgId);

  // --- Thread ---------------------------------------------------------------
  let thread = params.threadId
    ? await store.getEmployeeChatThread(orgId, params.threadId)
    : await store.getLatestEmployeeChatThreadForEmployee(orgId, employee.id);
  if (thread && (thread.employeeId !== employee.id || thread.status !== "active")) thread = null;

  if (!thread) {
    thread = await store.createEmployeeChatThread({
      organizationId: orgId,
      employeeId: employee.id,
      title: threadTitle(message),
      createdByUserId: actor.userId,
    });
    await store.createAuditEvent({
      organizationId: orgId,
      actorType,
      actorId: actor.userId,
      action: "employee_chat.thread_created",
      targetType: "employee_chat_thread",
      targetId: thread.id,
      metadata: { employeeId: employee.id, threadId: thread.id },
    });
  }

  // History BEFORE storing the new user message (so it isn't duplicated).
  const history = await store.listEmployeeChatMessages(orgId, thread.id);

  const userMessage = await store.createEmployeeChatMessage({
    organizationId: orgId,
    threadId: thread.id,
    employeeId: employee.id,
    role: "user",
    content: message,
    status: "sent",
    createdByUserId: actor.userId,
  });
  await store.createAuditEvent({
    organizationId: orgId,
    actorType,
    actorId: actor.userId,
    action: "employee_chat.message_sent",
    targetType: "employee_chat_message",
    targetId: userMessage.id,
    metadata: { employeeId: employee.id, threadId: thread.id, messageId: userMessage.id },
  });

  // --- Retrieval (assigned knowledge only) ---------------------------------
  const retrieval = await retrieveForEmployee(store, {
    organizationId: orgId,
    employeeId: employee.id,
    query: message,
  });
  const sources = toSourceReferences(retrieval.excerpts);

  await store.createEmployeeChatRetrievalEvent({
    organizationId: orgId,
    employeeId: employee.id,
    threadId: thread.id,
    messageId: userMessage.id,
    queryTextHash: hashQuery(message),
    retrievedSourceCount: retrieval.topSourceIds.length,
    topSourceIds: retrieval.topSourceIds,
  });
  await store.createAuditEvent({
    organizationId: orgId,
    actorType,
    actorId: actor.userId,
    action: "knowledge_retrieval.searched",
    targetType: "employee",
    targetId: employee.id,
    metadata: {
      employeeId: employee.id,
      threadId: thread.id,
      retrievedSourceCount: retrieval.topSourceIds.length,
    },
  });

  const context = buildRuntimeContext({
    organizationName,
    employee,
    dna: published.dna,
    excerpts: retrieval.excerpts,
    history,
    userMessage: message,
  });

  // --- Generate via the MODEL GATEWAY only ---------------------------------
  try {
    const response = await gateway.generateText({
      organizationId: orgId,
      employeeId: employee.id,
      taskType: "employee_chat",
      messages: context.messages,
      createdByUserId: actor.userId,
    });
    const brainMode: "live" | "local_demo" = response.demo ? "local_demo" : "live";

    const assistantMessage = await store.createEmployeeChatMessage({
      organizationId: orgId,
      threadId: thread.id,
      employeeId: employee.id,
      role: "assistant",
      content: response.text,
      status: "sent",
      sourceReferences: sources.length > 0 ? sources : null,
      modelProviderSlug: response.providerSlug,
      modelId: response.modelId,
      modelTier: resolution.model.modelTier,
      routingMode: resolution.routingMode,
      inputTokens: response.inputTokens ?? null,
      outputTokens: response.outputTokens ?? null,
      estimatedCostUsd: response.estimatedCostUsd,
      latencyMs: response.latencyMs,
      brainMode,
      createdByUserId: actor.userId,
    });

    await store.createAuditEvent({
      organizationId: orgId,
      actorType,
      actorId: actor.userId,
      action: "employee_chat.response_generated",
      targetType: "employee_chat_message",
      targetId: assistantMessage.id,
      metadata: {
        employeeId: employee.id,
        threadId: thread.id,
        messageId: assistantMessage.id,
        providerSlug: response.providerSlug,
        modelId: response.modelId,
        estimatedCostUsd: response.estimatedCostUsd,
        latencyMs: response.latencyMs,
        retrievedSourceCount: retrieval.topSourceIds.length,
        status: "sent",
      },
    });

    return {
      thread,
      userMessage,
      assistantMessage,
      sources,
      brainMode,
      demo: !!response.demo,
      status: "sent",
    };
  } catch (error) {
    // Never leak provider error details to the end user.
    const errorCode = error instanceof GatewayError ? error.code : "chat_failed";
    const assistantMessage = await store.createEmployeeChatMessage({
      organizationId: orgId,
      threadId: thread.id,
      employeeId: employee.id,
      role: "assistant",
      content: FRIENDLY_ERROR_MESSAGE,
      status: "failed",
      sourceReferences: sources.length > 0 ? sources : null,
      modelProviderSlug: resolution.providerSlug,
      modelId: resolution.model.modelId,
      modelTier: resolution.model.modelTier,
      routingMode: resolution.routingMode,
      errorCode,
      createdByUserId: actor.userId,
    });

    await store.createAuditEvent({
      organizationId: orgId,
      actorType,
      actorId: actor.userId,
      action: "employee_chat.response_failed",
      targetType: "employee_chat_message",
      targetId: assistantMessage.id,
      metadata: {
        employeeId: employee.id,
        threadId: thread.id,
        messageId: assistantMessage.id,
        status: "failed",
        errorCode,
      },
    });

    return {
      thread,
      userMessage,
      assistantMessage,
      sources,
      brainMode: "live",
      demo: false,
      status: "failed",
    };
  }
}
