import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { hasPermission } from "@/modules/organizations/roles";

/**
 * Batch 3 — employee-detail Usage + Recent activity tiles now read real,
 * organization-scoped data. Covers the two new store reads plus the permission
 * boundary and cross-org isolation.
 */

async function seedInteraction(
  store: InMemoryStore,
  organizationId: string,
  employeeId: string,
  taskType: Parameters<InMemoryStore["createLlmUsageEvent"]>[0]["taskType"],
  status: "success" | "error" | "blocked" = "success",
) {
  return store.createLlmUsageEvent({
    organizationId,
    employeeId,
    providerSlug: "openai",
    modelId: "gpt-5.4",
    taskType,
    inputTokens: 1,
    outputTokens: 1,
    status,
  });
}

describe("countInteractionsForEmployee", () => {
  it("counts only billable, non-blocked interactions for the given employee", async () => {
    const store = new InMemoryStore();
    // Billable for emp-1.
    await seedInteraction(store, "org-1", "emp-1", "employee_chat");
    await seedInteraction(store, "org-1", "emp-1", "voice_realtime");
    // Non-billable task type — excluded.
    await seedInteraction(store, "org-1", "emp-1", "knowledge_summary");
    // Blocked — excluded.
    await seedInteraction(store, "org-1", "emp-1", "employee_chat", "blocked");
    // Different employee / org — excluded.
    await seedInteraction(store, "org-1", "emp-2", "employee_chat");
    await seedInteraction(store, "org-2", "emp-1", "employee_chat");

    expect(await store.countInteractionsForEmployee("org-1", "emp-1")).toBe(2);
    expect(await store.countInteractionsForEmployee("org-1", "emp-2")).toBe(1);
    expect(await store.countInteractionsForEmployee("org-1", "emp-missing")).toBe(0);
  });

  it("does not leak counts across organizations", async () => {
    const store = new InMemoryStore();
    await seedInteraction(store, "org-1", "emp-1", "employee_chat");
    // Same employee id under a different org must not be counted for org-1... it is,
    // because scoping is by (org, employee). Cross-org request returns only its own.
    await seedInteraction(store, "org-2", "emp-1", "employee_chat");
    await seedInteraction(store, "org-2", "emp-1", "employee_chat");
    expect(await store.countInteractionsForEmployee("org-1", "emp-1")).toBe(1);
    expect(await store.countInteractionsForEmployee("org-2", "emp-1")).toBe(2);
  });
});

describe("listAuditEventsForEmployee", () => {
  it("matches events by target and by metadata.employeeId, most recent first", async () => {
    const store = new InMemoryStore();
    // Targeted directly at the employee.
    await store.createAuditEvent({
      organizationId: "org-1",
      actorType: "user",
      actorId: "u1",
      action: "employee.created",
      targetType: "employee",
      targetId: "emp-1",
    });
    // Related via metadata.employeeId (e.g. a chat message event).
    await store.createAuditEvent({
      organizationId: "org-1",
      actorType: "user",
      actorId: "u1",
      action: "employee_chat.response_generated",
      targetType: "employee_chat_message",
      targetId: "msg-1",
      metadata: { employeeId: "emp-1" },
    });
    // Unrelated employee — excluded.
    await store.createAuditEvent({
      organizationId: "org-1",
      actorType: "user",
      actorId: "u1",
      action: "employee.updated",
      targetType: "employee",
      targetId: "emp-2",
    });

    const events = await store.listAuditEventsForEmployee("org-1", "emp-1");
    expect(events).toHaveLength(2);
    // Most recent first.
    expect(events[0]?.action).toBe("employee_chat.response_generated");
    expect(events[1]?.action).toBe("employee.created");
  });

  it("is organization-scoped — no cross-org leakage", async () => {
    const store = new InMemoryStore();
    await store.createAuditEvent({
      organizationId: "org-1",
      actorType: "user",
      actorId: "u1",
      action: "employee.created",
      targetType: "employee",
      targetId: "emp-1",
    });
    await store.createAuditEvent({
      organizationId: "org-2",
      actorType: "user",
      actorId: "u2",
      action: "employee.created",
      targetType: "employee",
      targetId: "emp-1",
    });

    const org1 = await store.listAuditEventsForEmployee("org-1", "emp-1");
    const org2 = await store.listAuditEventsForEmployee("org-2", "emp-1");
    expect(org1).toHaveLength(1);
    expect(org2).toHaveLength(1);
    expect(org1[0]?.organizationId).toBe("org-1");
    expect(org2[0]?.organizationId).toBe("org-2");
  });

  it("respects the limit", async () => {
    const store = new InMemoryStore();
    for (let i = 0; i < 6; i++) {
      await store.createAuditEvent({
        organizationId: "org-1",
        actorType: "user",
        actorId: "u1",
        action: "employee_chat.message_sent",
        targetType: "employee",
        targetId: "emp-1",
      });
    }
    expect(await store.listAuditEventsForEmployee("org-1", "emp-1", 3)).toHaveLength(3);
  });
});

describe("Recent-activity permission boundary", () => {
  it("reuses audit.view — owner/admin only (builder/viewer excluded)", () => {
    // The employee detail page only reads the activity trail when this is true.
    expect(hasPermission("owner", "audit.view")).toBe(true);
    expect(hasPermission("admin", "audit.view")).toBe(true);
    expect(hasPermission("builder", "audit.view")).toBe(false);
    expect(hasPermission("viewer", "audit.view")).toBe(false);
  });
});
