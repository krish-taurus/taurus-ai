import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Role } from "@/modules/organizations/roles";

/**
 * Sprint 015 — item D (server-side permission denial). Drives the real billing
 * server actions with a mocked session and asserts that a role without
 * billing.manage is denied AT THE SERVER, returning an error and performing no
 * change — not merely hidden in the client. The organization comes from the
 * (mocked) session, never from the form.
 */

const h = vi.hoisted(() => ({ role: "viewer" as Role }));

vi.mock("@/lib/security/guards", () => ({
  requireCurrentOrganization: async () => ({
    user: { id: "user-1", email: "u@example.com" },
    organization: { id: "org-1", name: "Acme" },
    membership: { role: h.role },
  }),
}));

// If permission passed, the action would touch the store/provider — fail loudly
// so a broken check can never silently "pass" this test.
vi.mock("@/lib/db/store", () => ({
  getStore: () => {
    throw new Error("store should not be reached when permission is denied");
  },
}));
vi.mock("@/modules/billing/providers", () => ({
  getBillingProvider: () => {
    throw new Error("provider should not be reached when permission is denied");
  },
}));

import { choosePlanAction, manageBillingAction } from "@/modules/billing/actions";

beforeEach(() => {
  h.role = "viewer";
});

describe("Billing actions enforce billing.manage server-side", () => {
  for (const role of ["viewer", "builder"] as Role[]) {
    it(`denies choosePlanAction for ${role} without touching the store`, async () => {
      h.role = role;
      const form = new FormData();
      form.set("planId", "growth");
      const result = await choosePlanAction({}, form);
      expect(result.error).toMatch(/permission/i);
    });

    it(`denies manageBillingAction for ${role} without touching the store`, async () => {
      h.role = role;
      const result = await manageBillingAction({}, new FormData());
      expect(result.error).toMatch(/permission/i);
    });
  }
});
