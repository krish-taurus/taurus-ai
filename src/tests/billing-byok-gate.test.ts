import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Sprint 015 — BYOK is a paid-plan feature, enforced SERVER-SIDE (not merely
 * hidden in the UI). Drives the real Model Hub server action with a mocked
 * session and a controllable subscription plan, and proves that an org on a plan
 * without the `byok` feature (Starter) is refused with an upgrade message before
 * any key is stored, while a plan that includes it (Growth) is let through the
 * gate. The organization is resolved from the session, never from the form.
 */

const h = vi.hoisted(() => ({ planId: "starter" as string }));

vi.mock("@/lib/security/guards", () => ({
  requireCurrentOrganization: async () => ({
    user: { id: "user-1", email: "u@example.com" },
    organization: { id: "org-1", name: "Acme" },
    membership: { role: "owner" },
  }),
}));

// A minimal store: the org's subscription carries the plan under test. If the
// action ever tried to persist a key on a plan without BYOK, this would throw.
vi.mock("@/lib/db/store", () => ({
  getStore: () => ({
    getBillingSubscription: async () => ({
      id: "sub-1",
      organizationId: "org-1",
      planId: h.planId,
      status: "active",
    }),
    saveProviderCredential: async () => {
      throw new Error("a key must never be stored on a plan without BYOK");
    },
  }),
}));

import { saveProviderCredentialAction } from "@/modules/model-gateway/actions";

function keyForm() {
  const form = new FormData();
  form.set("providerSlug", "openai");
  form.set("apiKey", "sk-live-plaintext-4242");
  form.set("baseUrl", "");
  form.set("label", "");
  return form;
}

beforeEach(() => {
  h.planId = "starter";
});

describe("BYOK is gated to the paid plans at the server action", () => {
  it("refuses a Starter org with an upgrade message and stores nothing", async () => {
    h.planId = "starter";
    const result = await saveProviderCredentialAction({}, keyForm());
    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/growth|scale|upgrade/i);
    // Never reached the store (the throwing stub above was never called).
  });

  it("lets a Growth org past the plan gate (fails later only on key storage config, not the gate)", async () => {
    h.planId = "growth";
    const result = await saveProviderCredentialAction({}, keyForm());
    // The BYOK gate did NOT block Growth: any error here is about encryption
    // config, not the plan gate.
    expect(result.error ?? "").not.toMatch(/growth and scale plans/i);
  });
});
