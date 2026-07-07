/**
 * Audit presentation metadata (Prompt — Functionality Repair, Batch 1).
 *
 * Turns the internal audit `action` / `targetType` codes into clean,
 * business-friendly labels for the Audit dashboard. Taurus terminology only —
 * never surfaces "agent", "prompt", or "knowledge base". Pure and dependency-free.
 */

import type { AuditEvent } from "@/lib/db/types";

/** Friendly labels for the audit actions emitted across the app. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "organization.created": "Organization created",

  "employee.created": "AI Employee hired",
  "employee.updated": "AI Employee updated",
  "employee_brain.updated": "AI Employee brain updated",

  "employee_chat.thread_created": "Chat started",
  "employee_chat.message_sent": "Chat message sent",
  "employee_chat.response_generated": "AI Employee replied",
  "employee_chat.response_failed": "AI Employee reply failed",
  "employee_chat.thread_archived": "Chat archived",

  "employee_dna.draft_saved": "Employee DNA draft saved",
  "employee_dna.published": "Employee DNA published",
  "employee_dna.archived": "Employee DNA version archived",

  "knowledge_source.created": "Knowledge source added",
  "knowledge_source.updated": "Knowledge source updated",
  "knowledge_source.archived": "Knowledge source archived",
  "knowledge_source.assigned_to_employee": "Knowledge assigned to an AI Employee",
  "knowledge_source.unassigned_from_employee": "Knowledge removed from an AI Employee",
  "knowledge_document.uploaded": "Document uploaded",
  "knowledge_retrieval.prepared": "Knowledge prepared",
  "knowledge_retrieval.searched": "Knowledge searched",

  "model_settings.updated": "Model settings updated",
  "model_budget.updated": "Budget updated",
  "provider_credential.saved": "Provider key saved",
  "provider_credential.disabled": "Provider key removed",
  "provider_credential.tested": "Provider connection tested",

  "channel.created": "Connection created",
  "channel.updated": "Connection updated",
  "channel.activated": "Connection activated",
  "channel.paused": "Connection paused",
  "channel.archived": "Connection removed",
  "channel_provider_credential.saved": "Channel provider key saved",
  "channel_provider_credential.disabled": "Channel provider key removed",
  "messaging_message.delivery_updated": "Message delivery updated",
  "messaging_webhook.failed": "Messaging delivery issue",

  "voice_phone_number.created": "Phone number added",
  "voice_phone_number.updated": "Phone number updated",

  "billing.plan_upgraded": "Plan upgraded",
  "billing.plan_downgraded": "Plan changed",
  "billing.webhook_applied": "Billing updated",
};

/** Friendly labels for the audit target types. */
export const AUDIT_TARGET_LABELS: Record<string, string> = {
  organization: "Organization",
  employee: "AI Employee",
  employee_dna: "Employee DNA",
  employee_channel: "Connection",
  employee_chat_thread: "Chat",
  employee_chat_message: "Chat message",
  knowledge_source: "Knowledge source",
  knowledge_document: "Document",
  provider: "Model provider",
  voice_phone_number: "Phone number",
  billing_subscription: "Subscription",
};

/** Humanize an unknown code as a readable sentence-case fallback. */
function humanize(code: string): string {
  const text = code.replace(/[._]/g, " ").trim();
  return text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : "Activity";
}

/** A clean label for an audit action (known label, else humanized fallback). */
export function describeAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? humanize(action);
}

/** A clean label for an audit target type, or null when there is none. */
export function describeAuditTarget(targetType: string | null | undefined): string | null {
  if (!targetType) return null;
  return AUDIT_TARGET_LABELS[targetType] ?? humanize(targetType);
}

/** Fallback label for who performed an action when no name is available. */
export function describeActorType(actorType: AuditEvent["actorType"]): string {
  switch (actorType) {
    case "system":
      return "System";
    case "employee":
      return "AI Employee";
    default:
      return "A team member";
  }
}
