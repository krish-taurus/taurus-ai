import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import {
  assertEmployeeInOrganization,
  assertRole,
  resolveMembership,
  ForbiddenError,
  TenantAccessError,
} from "@/lib/security/tenancy";
import { createOrganizationForUser } from "@/modules/organizations/service";

async function setup() {
  const store = new InMemoryStore();
  const alice = await store.createUser({ email: "alice@example.com", fullName: "Alice" });
  const bob = await store.createUser({ email: "bob@example.com", fullName: "Bob" });
  return { store, alice, bob };
}

describe("tenant isolation", () => {
  it("makes the creator an owner and records an audit event", async () => {
    const { store, alice } = await setup();
    const { organization, membership } = await createOrganizationForUser(store, alice.id, {
      name: "Alice Co",
    });

    expect(membership.role).toBe("owner");
    expect(membership.status).toBe("active");

    const events = store._auditEvents();
    expect(events.some((e) => e.action === "organization.created")).toBe(true);
    expect(events[0].organizationId).toBe(organization.id);
    expect(events[0].actorId).toBe(alice.id);
  });

  it("denies access to an organization the user does not belong to", async () => {
    const { store, alice, bob } = await setup();
    const { organization } = await createOrganizationForUser(store, alice.id, { name: "Alice Co" });

    // Alice (owner) resolves fine.
    await expect(resolveMembership(store, alice.id, organization.id)).resolves.toMatchObject({
      role: "owner",
    });

    // Bob is not a member → denied.
    await expect(resolveMembership(store, bob.id, organization.id)).rejects.toBeInstanceOf(
      TenantAccessError,
    );
  });

  it("allows a user to belong to multiple organizations", async () => {
    const { store, alice } = await setup();
    const orgA = await createOrganizationForUser(store, alice.id, { name: "Org A" });
    const orgB = await createOrganizationForUser(store, alice.id, { name: "Org B" });

    const memberships = await store.listOrganizationsForUser(alice.id);
    const ids = memberships.map((m) => m.organization.id).sort();
    expect(ids).toEqual([orgA.organization.id, orgB.organization.id].sort());
    expect(memberships.every((m) => m.membership.role === "owner")).toBe(true);
  });

  it("does not leak one organization's membership into another", async () => {
    const { store, alice, bob } = await setup();
    const aliceOrg = await createOrganizationForUser(store, alice.id, { name: "Alice Co" });
    const bobOrg = await createOrganizationForUser(store, bob.id, { name: "Bob Co" });

    expect(await store.getMembership(aliceOrg.organization.id, bob.id)).toBeNull();
    expect(await store.getMembership(bobOrg.organization.id, alice.id)).toBeNull();
  });

  it("enforces role restrictions via assertRole", async () => {
    const { store, alice } = await setup();
    const { membership } = await createOrganizationForUser(store, alice.id, { name: "Alice Co" });

    expect(() => assertRole(membership, ["owner", "admin"])).not.toThrow();
    expect(() => assertRole(membership, ["admin", "builder"])).toThrow(ForbiddenError);
  });

  it("asserts an employee belongs to the organization", async () => {
    const { store, alice, bob } = await setup();
    const aliceOrg = await createOrganizationForUser(store, alice.id, { name: "Alice Co" });
    const bobOrg = await createOrganizationForUser(store, bob.id, { name: "Bob Co" });

    store._seedEmployee("emp-1", aliceOrg.organization.id);

    // Same org → ok.
    await expect(
      assertEmployeeInOrganization(store, "emp-1", aliceOrg.organization.id),
    ).resolves.toBeUndefined();

    // Cross-org → denied.
    await expect(
      assertEmployeeInOrganization(store, "emp-1", bobOrg.organization.id),
    ).rejects.toBeInstanceOf(TenantAccessError);

    // Unknown employee → denied.
    await expect(
      assertEmployeeInOrganization(store, "does-not-exist", aliceOrg.organization.id),
    ).rejects.toBeInstanceOf(TenantAccessError);
  });
});
