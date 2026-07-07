import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { hasPermission } from "@/modules/organizations/roles";
import {
  describeAuditAction,
  describeAuditTarget,
  describeActorType,
  AUDIT_ACTION_LABELS,
} from "@/modules/audit/metadata";

async function seedEvent(
  store: InMemoryStore,
  organizationId: string,
  action: string,
  extra: Partial<Parameters<InMemoryStore["createAuditEvent"]>[0]> = {},
) {
  return store.createAuditEvent({
    organizationId,
    actorType: "user",
    actorId: "user-1",
    action,
    targetType: "employee",
    targetId: "emp-1",
    metadata: {},
    ...extra,
  });
}

describe("listAuditEvents (store read path)", () => {
  it("returns an organization's events, most recent first, respecting the limit", async () => {
    const store = new InMemoryStore();
    for (let i = 0; i < 5; i++) {
      await seedEvent(store, "org-1", `employee.updated`, { targetId: `emp-${i}` });
    }

    const all = await store.listAuditEvents("org-1");
    expect(all).toHaveLength(5);
    // Most recent first: the last-written event (emp-4) is first.
    expect(all[0]?.targetId).toBe("emp-4");
    expect(all[4]?.targetId).toBe("emp-0");

    const limited = await store.listAuditEvents("org-1", 2);
    expect(limited).toHaveLength(2);
    expect(limited[0]?.targetId).toBe("emp-4");
  });

  it("is organization-scoped — no cross-org leakage", async () => {
    const store = new InMemoryStore();
    await seedEvent(store, "org-1", "employee.created");
    await seedEvent(store, "org-2", "employee.created");
    await seedEvent(store, "org-2", "knowledge_source.created");

    const org1 = await store.listAuditEvents("org-1");
    const org2 = await store.listAuditEvents("org-2");
    expect(org1).toHaveLength(1);
    expect(org2).toHaveLength(2);
    expect(org1.every((e) => e.organizationId === "org-1")).toBe(true);
    expect(org2.every((e) => e.organizationId === "org-2")).toBe(true);
  });

  it("returns an empty list for an organization with no events", async () => {
    const store = new InMemoryStore();
    expect(await store.listAuditEvents("org-empty")).toEqual([]);
  });
});

describe("Audit permissions (audit.view)", () => {
  it("grants audit.view to owner and admin only", () => {
    expect(hasPermission("owner", "audit.view")).toBe(true);
    expect(hasPermission("admin", "audit.view")).toBe(true);
    expect(hasPermission("builder", "audit.view")).toBe(false);
    expect(hasPermission("viewer", "audit.view")).toBe(false);
  });
});

describe("Audit labels (Taurus terminology)", () => {
  it("maps known actions to clean, business-friendly labels", () => {
    expect(describeAuditAction("employee.created")).toBe("AI Employee hired");
    expect(describeAuditAction("knowledge_source.created")).toBe("Knowledge source added");
    expect(describeAuditAction("billing.plan_upgraded")).toBe("Plan upgraded");
  });

  it("humanizes unknown action codes as a readable fallback", () => {
    expect(describeAuditAction("something.brand_new")).toBe("Something brand new");
  });

  it("maps target types and actor types", () => {
    expect(describeAuditTarget("employee")).toBe("AI Employee");
    expect(describeAuditTarget("billing_subscription")).toBe("Subscription");
    expect(describeAuditTarget(null)).toBeNull();
    expect(describeActorType("system")).toBe("System");
    expect(describeActorType("user")).toBe("A team member");
  });

  it("never surfaces forbidden terminology in any known label", () => {
    const forbidden = /\b(agents?|prompts?|bots?)\b|knowledge\s+base/i;
    for (const label of Object.values(AUDIT_ACTION_LABELS)) {
      expect(label, `label "${label}"`).not.toMatch(forbidden);
    }
  });
});
