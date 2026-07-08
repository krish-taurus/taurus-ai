import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { getOnboardingState, recordOnboardingCompletion } from "@/modules/onboarding/service";
import type { ChannelAppearance } from "@/lib/db/types";
import type { Role } from "@/modules/organizations/roles";

const APPEARANCE: ChannelAppearance = {
  theme: "dark",
  position: "bottom-right",
  launcherLabel: "Chat",
  employeeDisplayName: "Nova",
  accentStyle: "mono",
  showSources: true,
  collectVisitorEmail: false,
  brandName: null,
};

async function setup() {
  const store = new InMemoryStore();
  const user = await store.createUser({ email: "owner@example.com", fullName: "Owner" });
  const { organization } = await createOrganizationForUser(store, user.id, { name: "Acme" });
  const ctx = { organizationId: organization.id, userId: user.id, role: "owner" as Role };
  return { store, user, organization, ctx };
}

async function publishDna(
  store: InMemoryStore,
  organizationId: string,
  employeeId: string,
  userId: string,
) {
  const dna: EmployeeDnaV1 = {
    ...createEmptyDnaV1(),
    identity: { mission: "Help", roleSummary: "Support", primaryGoals: [], successCriteria: [] },
  };
  await store.saveEmployeeDnaDraft({ organizationId, employeeId, dna, userId });
  await store.publishEmployeeDna({ organizationId, employeeId, userId });
}

async function seedFullyOnboarded(store: InMemoryStore, organizationId: string, userId: string) {
  const employee = await store.createEmployee({
    organizationId,
    name: "Nova",
    roleTitle: "Support Specialist",
    department: "Support",
    description: null,
    status: "active",
    createdBy: null,
  });
  await publishDna(store, organizationId, employee.id, userId);
  await store.createKnowledgeSource({
    organizationId,
    name: "Pricing guide",
    description: null,
    sourceType: "text",
    visibility: "organization",
  });
  await store.createEmployeeChatThread({
    organizationId,
    employeeId: employee.id,
    title: "Test drive",
    createdByUserId: userId,
  });
  const channel = await store.createEmployeeChannel({
    organizationId,
    employeeId: employee.id,
    channelType: "website_widget",
    publicKey: "tc_widget",
    name: "Website",
    appearance: APPEARANCE,
  });
  await store.activateEmployeeChannel(organizationId, channel.id);
  return employee;
}

describe("Onboarding activation (Sprint 020)", () => {
  it("derives an empty checklist for a brand-new organization", async () => {
    const { store, ctx } = await setup();
    const state = await getOnboardingState(store, ctx);

    expect(state.steps).toHaveLength(5);
    expect(state.steps.every((s) => !s.done)).toBe(true);
    expect(state.requiredTotal).toBe(4); // knowledge is optional
    expect(state.requiredDone).toBe(0);
    expect(state.complete).toBe(false);
    expect(state.dismissed).toBe(false);
    expect(state.completionRecorded).toBe(false);
    expect(state.firstEmployeeId).toBeNull();
    // Owner can act on every step.
    expect(state.steps.every((s) => s.canAct && s.href !== null)).toBe(true);
  });

  it("marks the hire step done and points later steps at the first employee", async () => {
    const { store, ctx, organization } = await setup();
    const employee = await store.createEmployee({
      organizationId: organization.id,
      name: "Nova",
      roleTitle: "Support Specialist",
      department: "Support",
      description: null,
      status: "active",
      createdBy: null,
    });

    const state = await getOnboardingState(store, ctx);
    const byKey = Object.fromEntries(state.steps.map((s) => [s.key, s]));
    expect(byKey.hire.done).toBe(true);
    expect(byKey.dna.done).toBe(false);
    expect(state.firstEmployeeId).toBe(employee.id);
    expect(byKey.test_chat.href).toBe(`/dashboard/employees/${employee.id}/chat`);
    expect(byKey.deploy_web.href).toBe(`/dashboard/employees/${employee.id}/channels`);
    expect(state.complete).toBe(false);
  });

  it("detects every step from real data and reports completion", async () => {
    const { store, ctx, organization, user } = await setup();
    await seedFullyOnboarded(store, organization.id, user.id);

    const state = await getOnboardingState(store, ctx);
    expect(state.steps.every((s) => s.done)).toBe(true);
    expect(state.requiredDone).toBe(4);
    expect(state.complete).toBe(true);
  });

  it("is role-respecting: a viewer sees progress but not owner/admin actions", async () => {
    const { store, organization } = await setup();
    const viewerCtx = {
      organizationId: organization.id,
      userId: "viewer-1",
      role: "viewer" as Role,
    };
    const state = await getOnboardingState(store, viewerCtx);
    const byKey = Object.fromEntries(state.steps.map((s) => [s.key, s]));

    // Owner/admin/builder-only steps: no CTA for a viewer.
    for (const key of ["hire", "dna", "knowledge", "deploy_web"]) {
      expect(byKey[key].canAct).toBe(false);
      expect(byKey[key].href).toBeNull();
    }
    // Viewers can test in chat (employee_chat.use is granted to all roles).
    expect(byKey.test_chat.canAct).toBe(true);
    expect(byKey.test_chat.href).not.toBeNull();
  });

  it("dismisses and resumes the checklist (resumable)", async () => {
    const { store, ctx, organization, user } = await setup();

    await store.setOnboardingDismissed(organization.id, true, user.id);
    expect((await getOnboardingState(store, ctx)).dismissed).toBe(true);

    await store.setOnboardingDismissed(organization.id, false, user.id);
    expect((await getOnboardingState(store, ctx)).dismissed).toBe(false);
  });

  it("records the completion milestone exactly once and audits it", async () => {
    const { store, ctx, organization, user } = await setup();
    await seedFullyOnboarded(store, organization.id, user.id);

    await recordOnboardingCompletion(store, ctx);
    await recordOnboardingCompletion(store, ctx); // idempotent

    const completedAudits = store
      ._auditEvents()
      .filter((e) => e.action === "onboarding.completed");
    expect(completedAudits).toHaveLength(1);

    const progress = await store.getOnboardingProgress(organization.id);
    expect(progress?.completedAt).toBeTruthy();
    expect((await getOnboardingState(store, ctx)).completionRecorded).toBe(true);
  });
});
