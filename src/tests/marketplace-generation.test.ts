// @vitest-environment node
// generateListingCopy imports "server-only" + the model gateway, so it runs in
// the node environment. With no provider key configured and NODE_ENV=test, the
// gateway answers via the Local Demo Brain (demo allowed outside production).
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { createEmptyDnaV1 } from "@/modules/employee-dna/schema";
import { generateListingCopy, generateVaultDescription } from "@/modules/marketplace/generation";
import { MarketplaceError } from "@/modules/marketplace/service";

async function setup() {
  const store = new InMemoryStore();
  const user = await store.createUser({ email: "u@x.com", fullName: "U" });
  const org = (await createOrganizationForUser(store, user.id, { name: "Co" })).organization;
  const employee = await store.createEmployee({
    organizationId: org.id,
    name: "Nova",
    roleTitle: "Support",
  });
  return { store, org, user, employee };
}

describe("marketplace AI generation (demo mode)", () => {
  it("generates listing copy from published DNA", async () => {
    const { store, org, user, employee } = await setup();
    const dna = {
      ...createEmptyDnaV1(),
      identity: {
        mission: "Help customers succeed.",
        roleSummary: "Senior Support Specialist",
        primaryGoals: ["Resolve tickets fast"],
        successCriteria: [],
      },
    };
    await store.saveEmployeeDnaDraft({ organizationId: org.id, employeeId: employee.id, dna, userId: user.id });
    await store.publishEmployeeDna({ organizationId: org.id, employeeId: employee.id, userId: user.id });

    const copy = await generateListingCopy(store, { organizationId: org.id, employeeId: employee.id });
    expect(typeof copy.headline).toBe("string");
    expect(copy.headline.length).toBeGreaterThan(0);
    expect(typeof copy.summary).toBe("string");
    // Falls back to the role for the headline if the model didn't return JSON.
    expect(copy.headline.length).toBeLessThanOrEqual(140);
  });

  it("requires published DNA", async () => {
    const { store, org, employee } = await setup();
    await expect(
      generateListingCopy(store, { organizationId: org.id, employeeId: employee.id }),
    ).rejects.toBeInstanceOf(MarketplaceError);
  });

  it("vault description generation is best-effort (returns a string or null, never throws)", async () => {
    const { store, org, employee } = await setup();
    const res = await generateVaultDescription(store, {
      organizationId: org.id,
      employeeId: employee.id,
      roleSummary: "Support",
      vaultName: "Refund policy",
    });
    expect(res === null || typeof res === "string").toBe(true);
  });
});
