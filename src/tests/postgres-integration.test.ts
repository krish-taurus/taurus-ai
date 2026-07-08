import { describe, it, expect, beforeAll } from "vitest";
import { PostgresStore } from "@/lib/db/postgres-store";
import { createOrganizationForUser } from "@/modules/organizations/service";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { getOnboardingState, recordOnboardingCompletion } from "@/modules/onboarding/service";
import type { ChannelAppearance } from "@/lib/db/types";

/**
 * PostgreSQL integration parity (Sprint 020 follow-up).
 *
 * Proves the real PostgresStore works end-to-end against a freshly migrated
 * database — i.e. the migration chain produces exactly the schema the code
 * expects, so a fresh build does not break any feature. Exercises the core
 * entities plus the Sprint 020 onboarding + audit paths.
 *
 * Inert unless DATABASE_URL is set (so the normal test run, which uses the
 * in-memory store, is unaffected). Run it with:
 *   DATABASE_URL=postgres://… npx vitest run src/tests/postgres-integration.test.ts
 */

const DATABASE_URL = process.env.DATABASE_URL;

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

describe.skipIf(!DATABASE_URL)("PostgresStore parity on a fresh schema", () => {
  let store: PostgresStore;
  // Unique suffix so repeated runs against the same database never collide.
  const stamp = `${process.pid}-${Math.floor(performance.now())}`;

  beforeAll(() => {
    store = new PostgresStore();
  });

  it("runs the full hire → DNA → knowledge → chat → deploy → onboarding flow", async () => {
    const user = await store.createUser({
      email: `owner+${stamp}@example.com`,
      fullName: "Owner",
    });
    const { organization } = await createOrganizationForUser(store, user.id, {
      name: `Acme ${stamp}`,
    });
    const ctx = { organizationId: organization.id, userId: user.id, role: "owner" as const };

    // Brand-new org: nothing done, nothing dismissed.
    const empty = await getOnboardingState(store, ctx);
    expect(empty.complete).toBe(false);
    expect(empty.requiredDone).toBe(0);

    // Hire.
    const employee = await store.createEmployee({
      organizationId: organization.id,
      name: "Nova",
      roleTitle: "Support Specialist",
      department: "Support",
      description: null,
      status: "active",
      createdBy: null,
    });

    // DNA draft + publish.
    const dna: EmployeeDnaV1 = {
      ...createEmptyDnaV1(),
      identity: { mission: "Help", roleSummary: "Support", primaryGoals: [], successCriteria: [] },
    };
    await store.saveEmployeeDnaDraft({
      organizationId: organization.id,
      employeeId: employee.id,
      dna,
      userId: user.id,
    });
    await store.publishEmployeeDna({
      organizationId: organization.id,
      employeeId: employee.id,
      userId: user.id,
    });
    expect(await store.getPublishedEmployeeDna(organization.id, employee.id)).not.toBeNull();

    // Knowledge source.
    await store.createKnowledgeSource({
      organizationId: organization.id,
      name: "Pricing guide",
      description: null,
      sourceType: "text",
      visibility: "organization",
    });

    // Chat thread (a "test in chat").
    await store.createEmployeeChatThread({
      organizationId: organization.id,
      employeeId: employee.id,
      title: "Test drive",
      createdByUserId: user.id,
    });

    // Deploy a web widget channel.
    const channel = await store.createEmployeeChannel({
      organizationId: organization.id,
      employeeId: employee.id,
      channelType: "website_widget",
      publicKey: `tc_${stamp}`,
      name: "Website",
      appearance: APPEARANCE,
    });
    await store.activateEmployeeChannel(organization.id, channel.id);

    // Every required onboarding step is now satisfied from real Postgres data.
    const done = await getOnboardingState(store, ctx);
    expect(done.steps.every((s) => s.done)).toBe(true);
    expect(done.complete).toBe(true);

    // Onboarding progress persists (Sprint 020 table).
    await store.setOnboardingDismissed(organization.id, true, user.id);
    expect((await store.getOnboardingProgress(organization.id))?.dismissedAt).toBeTruthy();
    await store.setOnboardingDismissed(organization.id, false, user.id);
    expect((await store.getOnboardingProgress(organization.id))?.dismissedAt).toBeNull();

    // Completion milestone records once + writes an audit event.
    await recordOnboardingCompletion(store, ctx);
    await recordOnboardingCompletion(store, ctx);
    const audits = await store.listAuditEvents(organization.id, 100);
    expect(audits.filter((e) => e.action === "onboarding.completed")).toHaveLength(1);
    expect((await store.getOnboardingProgress(organization.id))?.completedAt).toBeTruthy();
  });
});
