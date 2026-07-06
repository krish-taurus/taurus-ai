import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { hireEmployee, hireEmployeeSchema } from "@/modules/employees/hiring";
import {
  ESCALATION_OPTIONS,
  FORMALITY_OPTIONS,
  HIRING_TEMPLATES,
  RISK_OPTIONS,
  TONE_OPTIONS,
  getHiringTemplate,
} from "@/modules/employees/hiring-templates";

const REQUIRED_ROLES = [
  "receptionist",
  "sales",
  "customer_support",
  "hr",
  "finance",
  "operations",
  "legal_assistant",
  "marketing",
  "custom",
];

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
  template: "customer_support",
  name: "Maya",
  roleTitle: "Customer Support AI",
  department: "Support",
  description: "Answers customer questions.",
  responsibilities: ["Answer common support questions", "Escalate complex problems to a human"],
  tone: "friendly",
  formality: "balanced",
  riskLevel: "conservative",
  escalation: "ask_when_unsure",
};

describe("Hiring Studio template metadata", () => {
  it("provides every required role plus custom", () => {
    const keys = HIRING_TEMPLATES.map((t) => t.key);
    for (const role of REQUIRED_ROLES) {
      expect(keys).toContain(role);
    }
  });

  it("gives each non-custom template complete, valid defaults", () => {
    for (const template of HIRING_TEMPLATES) {
      expect(TONE_OPTIONS).toContain(template.workingStyle.tone);
      expect(FORMALITY_OPTIONS).toContain(template.workingStyle.formality);
      expect(RISK_OPTIONS).toContain(template.workingStyle.riskLevel);
      expect(ESCALATION_OPTIONS).toContain(template.workingStyle.escalation);

      if (template.key !== "custom") {
        expect(template.roleTitle.length).toBeGreaterThan(0);
        expect(template.department.length).toBeGreaterThan(0);
        expect(template.description.length).toBeGreaterThan(0);
        expect(template.responsibilities.length).toBeGreaterThan(0);
      }
    }
  });

  it("matches the documented Receptionist example", () => {
    const receptionist = getHiringTemplate("receptionist");
    expect(receptionist).toBeDefined();
    expect(receptionist!.roleTitle).toBe("AI Receptionist");
    expect(receptionist!.department).toBe("Front Office");
    expect(receptionist!.workingStyle).toEqual({
      tone: "warm",
      formality: "balanced",
      riskLevel: "conservative",
      escalation: "ask_when_unsure",
    });
    expect(receptionist!.responsibilities).toContain("Answer common customer questions");
    expect(receptionist!.responsibilities).toContain("Route requests to the right team");
  });
});

describe("hireEmployee", () => {
  it("creates a draft, private employee with responsibilities and working style", async () => {
    const { store, alice, aliceOrg } = await setup();
    const employee = await hireEmployee(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      validInput,
    );

    expect(employee.organizationId).toBe(aliceOrg.id);
    expect(employee.status).toBe("draft");
    expect(employee.visibility).toBe("private");
    expect(employee.createdBy).toBe(alice.id);
    expect(employee.responsibilities).toEqual(validInput.responsibilities);
    expect(employee.workingStyle).toEqual({
      tone: "friendly",
      formality: "balanced",
      riskLevel: "conservative",
      escalation: "ask_when_unsure",
    });

    // Appears in the organization's employee list.
    const list = await store.listEmployees(aliceOrg.id);
    expect(list.map((e) => e.id)).toContain(employee.id);
  });

  it("records an employee.created audit event via the Hiring Studio", async () => {
    const { store, alice, aliceOrg } = await setup();
    const employee = await hireEmployee(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      validInput,
    );

    const created = store._auditEvents().filter((e) => e.action === "employee.created");
    expect(created).toHaveLength(1);
    expect(created[0].targetId).toBe(employee.id);
    expect(created[0].organizationId).toBe(aliceOrg.id);
    expect(created[0].metadata).toMatchObject({ hiredVia: "hiring_studio" });
  });

  it("never exposes a hired employee to another organization", async () => {
    const { store, alice, aliceOrg, bobOrg } = await setup();
    const employee = await hireEmployee(
      store,
      { organizationId: aliceOrg.id, userId: alice.id },
      validInput,
    );

    expect(await store.getEmployee(aliceOrg.id, employee.id)).not.toBeNull();
    expect(await store.getEmployee(bobOrg.id, employee.id)).toBeNull();
    expect(await store.listEmployees(bobOrg.id)).toHaveLength(0);
  });

  it("rejects an invalid working style", async () => {
    const { store, alice, aliceOrg } = await setup();
    await expect(
      hireEmployee(
        store,
        { organizationId: aliceOrg.id, userId: alice.id },
        { ...validInput, tone: "sarcastic" },
      ),
    ).rejects.toThrow();
  });

  it("rejects a missing name with a friendly message", () => {
    const result = hireEmployeeSchema.safeParse({ ...validInput, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/name/i);
    }
  });
});
