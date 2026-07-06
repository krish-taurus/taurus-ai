import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { hasPermission } from "@/modules/organizations/roles";
import { createEmptyDnaV1, dnaSchemaV1 } from "@/modules/employee-dna/schema";
import { buildDnaPrefill } from "@/modules/employee-dna/prefill";
import { DnaValidationError, publishDna, saveDnaDraft } from "@/modules/employee-dna/service";
import type { AiEmployee } from "@/lib/db/types";

async function setup() {
  const store = new InMemoryStore();
  const alice = await store.createUser({ email: "alice@example.com", fullName: "Alice" });
  const bob = await store.createUser({ email: "bob@example.com", fullName: "Bob" });
  const aliceOrg = (await createOrganizationForUser(store, alice.id, { name: "Alice Co" }))
    .organization;
  const bobOrg = (await createOrganizationForUser(store, bob.id, { name: "Bob Co" })).organization;
  const employee = await store.createEmployee({
    organizationId: aliceOrg.id,
    name: "Maya",
    roleTitle: "Customer Support AI",
    department: "Support",
    description: "Answers customer questions.",
    responsibilities: ["Answer common questions", "Escalate hard cases"],
    workingStyle: {
      tone: "friendly",
      formality: "balanced",
      riskLevel: "conservative",
      escalation: "ask_when_unsure",
    },
    createdBy: alice.id,
  });
  return { store, alice, bob, aliceOrg, bobOrg, employee };
}

const actorFor = (organizationId: string, userId: string) => ({ organizationId, userId });

describe("Employee DNA schema", () => {
  it("accepts an empty (default) DNA", () => {
    expect(dnaSchemaV1.safeParse(createEmptyDnaV1()).success).toBe(true);
  });

  it("rejects an invalid enum value", () => {
    const dna = createEmptyDnaV1();
    (dna.communicationStyle as { tone: string }).tone = "Sarcastic";
    expect(dnaSchemaV1.safeParse(dna).success).toBe(false);
  });

  it("rejects a structurally wrong object", () => {
    expect(dnaSchemaV1.safeParse({ identity: "nope" }).success).toBe(false);
  });
});

describe("DNA prefill from employee data", () => {
  it("maps employee fields and working style into DNA values", async () => {
    const { employee } = await setup();
    const dna = buildDnaPrefill(employee);

    expect(dna.identity.roleSummary).toBe("Customer Support AI in Support");
    expect(dna.identity.mission).toBe("Answers customer questions.");
    expect(dna.responsibilities.primaryResponsibilities).toEqual([
      "Answer common questions",
      "Escalate hard cases",
    ]);
    expect(dna.communicationStyle.tone).toBe("Friendly");
    expect(dna.communicationStyle.formality).toBe("Balanced");
    expect(dna.decisionStyle.riskLevel).toBe("Conservative");
    expect(dna.decisionStyle.escalationPreference).toBe("Ask human when unsure");

    // Prefill is a valid DNA.
    expect(dnaSchemaV1.safeParse(dna).success).toBe(true);
  });

  it("works for an employee with no working style", async () => {
    const { store, aliceOrg } = await setup();
    const bare = await store.createEmployee({
      organizationId: aliceOrg.id,
      name: "Sam",
      roleTitle: "Ops AI",
    });
    const dna = buildDnaPrefill(bare as AiEmployee);
    expect(dna.identity.roleSummary).toBe("Ops AI");
    expect(dnaSchemaV1.safeParse(dna).success).toBe(true);
  });
});

describe("DNA drafts", () => {
  it("creates version 1 as a draft and records an audit event", async () => {
    const { store, alice, aliceOrg, employee } = await setup();
    const draft = await saveDnaDraft(
      store,
      actorFor(aliceOrg.id, alice.id),
      employee.id,
      buildDnaPrefill(employee),
    );

    expect(draft.versionNumber).toBe(1);
    expect(draft.status).toBe("draft");
    expect(draft.schemaVersion).toBe("1.0");
    expect(draft.createdByUserId).toBe(alice.id);

    const saved = await store.getDraftEmployeeDna(aliceOrg.id, employee.id);
    expect(saved?.id).toBe(draft.id);
    expect(store._auditEvents().some((e) => e.action === "employee_dna.draft_saved")).toBe(true);
  });

  it("updates the same draft instead of creating a new version", async () => {
    const { store, alice, aliceOrg, employee } = await setup();
    const first = await saveDnaDraft(
      store,
      actorFor(aliceOrg.id, alice.id),
      employee.id,
      createEmptyDnaV1(),
    );
    const dna = createEmptyDnaV1();
    dna.identity.mission = "Updated mission";
    const second = await saveDnaDraft(store, actorFor(aliceOrg.id, alice.id), employee.id, dna);

    expect(second.id).toBe(first.id);
    expect(second.versionNumber).toBe(1);
    const versions = await store.listEmployeeDnaVersions(aliceOrg.id, employee.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].dna.identity.mission).toBe("Updated mission");
  });

  it("rejects invalid DNA with a friendly error", async () => {
    const { store, alice, aliceOrg, employee } = await setup();
    await expect(
      saveDnaDraft(store, actorFor(aliceOrg.id, alice.id), employee.id, { identity: "bad" }),
    ).rejects.toBeInstanceOf(DnaValidationError);
  });
});

describe("Publishing DNA", () => {
  it("publishes the draft and marks it published", async () => {
    const { store, alice, aliceOrg, employee } = await setup();
    const published = await publishDna(
      store,
      actorFor(aliceOrg.id, alice.id),
      employee.id,
      buildDnaPrefill(employee),
    );

    expect(published.status).toBe("published");
    expect(published.publishedAt).not.toBeNull();
    expect(published.publishedByUserId).toBe(alice.id);

    expect((await store.getPublishedEmployeeDna(aliceOrg.id, employee.id))?.id).toBe(published.id);
    expect(await store.getDraftEmployeeDna(aliceOrg.id, employee.id)).toBeNull();
    expect(store._auditEvents().some((e) => e.action === "employee_dna.published")).toBe(true);
  });

  it("increments the version and archives the previously published one", async () => {
    const { store, alice, aliceOrg, employee } = await setup();
    const actor = actorFor(aliceOrg.id, alice.id);

    const v1 = await publishDna(store, actor, employee.id, createEmptyDnaV1());
    expect(v1.versionNumber).toBe(1);

    // Editing after publish creates a new draft (version 2), then publish again.
    const dna2 = createEmptyDnaV1();
    dna2.identity.mission = "Second version";
    const draft2 = await saveDnaDraft(store, actor, employee.id, dna2);
    expect(draft2.versionNumber).toBe(2);

    const v2 = await publishDna(store, actor, employee.id, dna2);
    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe("published");

    const versions = await store.listEmployeeDnaVersions(aliceOrg.id, employee.id);
    expect(versions.map((v) => `${v.versionNumber}:${v.status}`)).toEqual([
      "2:published",
      "1:archived",
    ]);
  });

  it("throws when publishing without a draft", async () => {
    const { store, alice, aliceOrg, employee } = await setup();
    await expect(
      store.publishEmployeeDna({
        organizationId: aliceOrg.id,
        employeeId: employee.id,
        userId: alice.id,
      }),
    ).rejects.toThrow();
  });
});

describe("DNA organization isolation", () => {
  it("never exposes an employee's DNA to another organization", async () => {
    const { store, alice, aliceOrg, bobOrg, employee } = await setup();
    await saveDnaDraft(store, actorFor(aliceOrg.id, alice.id), employee.id, createEmptyDnaV1());

    expect(await store.getDraftEmployeeDna(aliceOrg.id, employee.id)).not.toBeNull();
    // Same employee id, wrong organization → nothing.
    expect(await store.getDraftEmployeeDna(bobOrg.id, employee.id)).toBeNull();
    const overview = await store.getEmployeeDnaOverview(bobOrg.id, employee.id);
    expect(overview.versions).toHaveLength(0);
  });
});

describe("DNA permissions (role matrix)", () => {
  it("lets builders edit DNA but not publish", () => {
    expect(hasPermission("builder", "employee_dna.edit")).toBe(true);
    expect(hasPermission("builder", "employee.manage")).toBe(false);
  });

  it("lets owners and admins publish; viewers cannot edit", () => {
    expect(hasPermission("owner", "employee.manage")).toBe(true);
    expect(hasPermission("admin", "employee_dna.edit")).toBe(true);
    expect(hasPermission("viewer", "employee_dna.edit")).toBe(false);
  });
});
