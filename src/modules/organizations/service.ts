/**
 * Organization service (Prompt 002).
 *
 * Pure business logic (given a DataStore) for creating an organization. Kept
 * free of Next.js so it can be unit-tested. The server action in actions.ts
 * wraps this with the authenticated user and redirects.
 *
 * Creating an organization:
 *   - creates the organization,
 *   - makes the creator the OWNER,
 *   - records an `organization.created` audit event.
 */

import { z } from "zod";
import type { DataStore } from "@/lib/db/store";
import type { OrganizationMembershipView } from "@/lib/db/types";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Organization name must be at least 2 characters.").max(120),
});

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;

/** Turn a name into a URL-safe slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Build a slug that is unique within the store by appending a short suffix. */
async function uniqueSlug(store: DataStore, name: string): Promise<string> {
  const base = slugify(name) || "organization";
  if (!(await store.getOrganizationBySlug(base))) return base;
  // Append a short random suffix until unique (bounded attempts).
  for (let i = 0; i < 5; i++) {
    const suffix = globalThis.crypto.randomUUID().slice(0, 6);
    const candidate = `${base}-${suffix}`;
    if (!(await store.getOrganizationBySlug(candidate))) return candidate;
  }
  throw new Error("Could not generate a unique organization slug. Please try a different name.");
}

export async function createOrganizationForUser(
  store: DataStore,
  userId: string,
  input: CreateOrganizationValues,
): Promise<OrganizationMembershipView> {
  const values = createOrganizationSchema.parse(input);
  const slug = await uniqueSlug(store, values.name);

  const result = await store.createOrganizationWithOwner({
    organization: { name: values.name, slug },
    ownerUserId: userId,
    ownerRole: "owner",
  });

  await store.createAuditEvent({
    organizationId: result.organization.id,
    actorType: "user",
    actorId: userId,
    action: "organization.created",
    targetType: "organization",
    targetId: result.organization.id,
    metadata: { name: result.organization.name, slug: result.organization.slug },
  });

  return result;
}
