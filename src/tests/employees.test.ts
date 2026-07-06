import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import {
  archiveEmployee,
  createEmployeeForOrganization,
  EmployeeNotFoundError,
  pauseEmployee,
  updateEmployeeProfile,
} from "@/modules/employees/service";

async function setup() {
  const store = new InMemoryStore();
  const alice = await store.createUser({ email: "alice@example.com", fullName: "Alice" });
  const bob = await store.createUser({ email: "bob@example.com", fullName: "Bob" });
  const aliceOrg = (await createOrganizationForUser(store, alice.id, { name: "Alice Co" }))
    .organization;
  const bobOrg = (await createOrganizationForUser(store, bob.id, { name: "Bob Co" })).organization;
  return { store, alice, bob, aliceOrg, bobOrg };
}

const validInput = {
  name: "Maya",
  roleTitle: "Customer Support AI",
  department: "Support",
  description: "Answers customer questions.",
};

describe("AI Employee service", () => {
  it("creates an employee with safe defaults and records employee.created", async () => {
    const { store, alice, aliceOrg } = await setup();
    const employee = await createEmployeeForOrganization(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      validInput,
    );

    expect(employee.organizationId).toBe(aliceOrg.id);
    expect(employee.status).toBe("draft");
    expect(employee.visibility).toBe("private");
    expect(employee.createdBy).toBe(alice.id);

    const list = await store.listEmployees(aliceOrg.id);
    expect(list.map((e) => e.id)).toContain(employee.id);

    const created = store._auditEvents().filter((e) => e.action === "employee.created");
    expect(created).toHaveLength(1);
    expect(created[0].targetId).toBe(employee.id);
    expect(created[0].organizationId).toBe(aliceOrg.id);
  });

  it("never exposes an employee across organizations", async () => {
    const { store, alice, aliceOrg, bobOrg } = await setup();
    const employee = await createEmployeeForOrganization(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      validInput,
    );

    // Same org can read it.
    expect(await store.getEmployee(aliceOrg.id, employee.id)).not.toBeNull();
    // Another org cannot read or list it.
    expect(await store.getEmployee(bobOrg.id, employee.id)).toBeNull();
    expect(await store.listEmployees(bobOrg.id)).toHaveLength(0);
  });

  it("refuses to update an employee from another organization", async () => {
    const { store, alice, bob, aliceOrg, bobOrg } = await setup();
    const employee = await createEmployeeForOrganization(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      validInput,
    );

    await expect(
      updateEmployeeProfile(store, { organizationId: bobOrg.id, userId: bob.id }, employee.id, {
        ...validInput,
        status: "active",
        visibility: "organization",
      }),
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);
  });

  it("updates profile fields and records employee.updated", async () => {
    const { store, alice, aliceOrg } = await setup();
    const employee = await createEmployeeForOrganization(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      validInput,
    );

    const updated = await updateEmployeeProfile(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      employee.id,
      {
        name: "Maya R.",
        roleTitle: "Senior Support AI",
        department: "Customer Success",
        description: "Handles escalations.",
        status: "active",
        visibility: "organization",
      },
    );

    expect(updated.name).toBe("Maya R.");
    expect(updated.status).toBe("active");
    expect(updated.visibility).toBe("organization");
    expect(store._auditEvents().some((e) => e.action === "employee.updated")).toBe(true);
  });

  it("emits employee.paused when the edit form pauses an employee", async () => {
    const { store, alice, aliceOrg } = await setup();
    const employee = await createEmployeeForOrganization(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      validInput,
    );

    await updateEmployeeProfile(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      employee.id,
      { ...validInput, status: "paused", visibility: "private" },
    );

    expect(store._auditEvents().some((e) => e.action === "employee.paused")).toBe(true);
  });

  it("pauses and archives via lifecycle helpers with audit events", async () => {
    const { store, alice, aliceOrg } = await setup();
    const employee = await createEmployeeForOrganization(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      validInput,
    );

    const paused = await pauseEmployee(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      employee.id,
    );
    expect(paused.status).toBe("paused");

    const archived = await archiveEmployee(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      employee.id,
    );
    expect(archived.status).toBe("archived");

    const actions = store._auditEvents().map((e) => e.action);
    expect(actions).toContain("employee.paused");
    expect(actions).toContain("employee.archived");
  });

  it("rejects invalid input via the create schema", async () => {
    const { store, alice, aliceOrg } = await setup();
    await expect(
      createEmployeeForOrganization(
        store,
        { organizationId: aliceOrg.id, userId: alice.id },
        { name: "A", roleTitle: "" },
      ),
    ).rejects.toThrow();
  });
});
