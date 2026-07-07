/**
 * Model access mode (Sprint 016) — server only.
 *
 * Changes an organization's model access mode (managed ↔ byok) and writes a
 * metadata-only audit event. The org is resolved from the session by the caller;
 * the permission check (owner/admin only) is enforced in the server action.
 */

import type { DataStore } from "@/lib/db/store";
import type { ModelAccessMode, Organization } from "@/lib/db/types";
import { isModelAccessMode } from "@/lib/db/types";

export class AccessModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessModeError";
  }
}

export interface AccessModeActor {
  organizationId: string;
  userId: string;
}

/**
 * Set the organization's model access mode, auditing the change. A no-op change
 * still returns the current org but writes no audit event.
 */
export async function setModelAccessMode(
  store: DataStore,
  actor: AccessModeActor,
  mode: unknown,
): Promise<Organization> {
  if (!isModelAccessMode(mode)) {
    throw new AccessModeError("Choose a valid access mode.");
  }
  const org = await store.getOrganizationById(actor.organizationId);
  if (!org) throw new AccessModeError("Organization not found.");
  if (org.modelAccessMode === mode) return org;

  const updated = await store.updateOrganizationModelAccessMode(actor.organizationId, mode);
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "model_access_mode.changed",
    targetType: "organization",
    targetId: actor.organizationId,
    metadata: { previous: org.modelAccessMode, next: mode as ModelAccessMode },
  });
  return updated;
}
