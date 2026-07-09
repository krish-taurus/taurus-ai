import { describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createWebChannel } from "@/modules/channels/service";
import { hasPermission, ROLES } from "@/modules/organizations/roles";
import type { AiEmployee, ChannelType } from "@/lib/db/types";
import {
  CONFIGURABLE_CONNECTION_TYPES,
  CONNECTION_SETUP_STATE_LABELS,
  CONNECTION_TYPE_ORDER,
  connectionAvailability,
  connectionSetupHref,
  connectionTestAvailable,
  connectionTestHref,
  connectionTestOpensLiveSurface,
  filterConnections,
  isConfigurableType,
  providerLabel,
} from "@/modules/channels/connections";

function seedEmployee(
  store: InMemoryStore,
  organizationId: string,
  name: string,
): Promise<AiEmployee> {
  return store.createEmployee({
    organizationId,
    name,
    roleTitle: "Support",
    department: "Support",
    description: null,
    status: "active",
    createdBy: null,
  });
}

/**
 * Put a bare (directly-seeded) org on a paid plan so its connection cap allows
 * multiple channels. Orgs created via the normal flow start on Starter (1
 * connection); these fixtures seed the store directly, so we grant a higher plan
 * explicitly to exercise multi-connection filtering (Sprint 015).
 */
function seedScalePlan(store: InMemoryStore, organizationId: string): Promise<unknown> {
  return store.createBillingSubscription({ organizationId, planId: "scale", status: "active" });
}

// --- Org-wide channel listing (store) --------------------------------------

describe("listEmployeeChannelsForOrganization", () => {
  it("returns every channel across all employees, organization-scoped", async () => {
    const store = new InMemoryStore();
    await seedScalePlan(store, "org-1");
    await seedScalePlan(store, "org-2");
    const maya = await seedEmployee(store, "org-1", "Maya");
    const atlas = await seedEmployee(store, "org-1", "Atlas");
    const other = await seedEmployee(store, "org-2", "Nova");

    await createWebChannel(store, { organizationId: "org-1", userId: "u1" }, maya, {
      name: "Maya web",
    });
    await createWebChannel(store, { organizationId: "org-1", userId: "u1" }, atlas, {
      name: "Atlas web",
    });
    await createWebChannel(store, { organizationId: "org-2", userId: "u2" }, other, {
      name: "Nova web",
    });

    const org1 = await store.listEmployeeChannelsForOrganization("org-1");
    expect(org1).toHaveLength(2);
    expect(org1.every((c) => c.organizationId === "org-1")).toBe(true);

    const org2 = await store.listEmployeeChannelsForOrganization("org-2");
    expect(org2).toHaveLength(1);
    // No cross-organization leakage.
    expect(org1.some((c) => c.employeeId === other.id)).toBe(false);
  });

  it("returns an empty list for an organization with no connections", async () => {
    const store = new InMemoryStore();
    expect(await store.listEmployeeChannelsForOrganization("org-empty")).toEqual([]);
  });
});

// --- Connection catalog metadata -------------------------------------------

describe("connection catalog metadata", () => {
  it("lists all twelve required connection types in order", () => {
    expect(CONNECTION_TYPE_ORDER).toEqual([
      "website_widget",
      "hosted_chat",
      "iframe_embed",
      "public_api",
      "whatsapp",
      "sms",
      "email",
      "telegram",
      "phone_call",
      "slack",
      "microsoft_teams",
      "instagram_dm",
    ]);
  });

  it("marks web as available, messaging/voice/telegram as foundation, and the rest as coming soon", () => {
    for (const type of [
      "website_widget",
      "hosted_chat",
      "iframe_embed",
      "public_api",
    ] as ChannelType[]) {
      expect(connectionAvailability(type)).toBe("available");
    }
    for (const type of ["whatsapp", "sms", "email", "telegram", "phone_call", "slack"] as ChannelType[]) {
      expect(connectionAvailability(type)).toBe("foundation");
    }
    for (const type of ["microsoft_teams", "instagram_dm"] as ChannelType[]) {
      expect(connectionAvailability(type)).toBe("coming_soon");
    }
  });

  it("only offers available + foundation types for configuration", () => {
    expect(CONFIGURABLE_CONNECTION_TYPES).toEqual([
      "website_widget",
      "hosted_chat",
      "iframe_embed",
      "public_api",
      "whatsapp",
      "sms",
      "email",
      "telegram",
      "phone_call",
      "slack",
    ]);
    expect(isConfigurableType("microsoft_teams")).toBe(false);
    expect(isConfigurableType("website_widget")).toBe(true);
    expect(isConfigurableType("slack")).toBe(true);
  });
});

// --- Setup routing reuses existing employee pages --------------------------

describe("connectionSetupHref", () => {
  it("routes each connection type to its existing employee setup page", () => {
    expect(connectionSetupHref("emp-1", "website_widget")).toBe(
      "/dashboard/employees/emp-1/channels",
    );
    expect(connectionSetupHref("emp-1", "public_api")).toBe("/dashboard/employees/emp-1/channels");
    expect(connectionSetupHref("emp-1", "phone_call")).toBe(
      "/dashboard/employees/emp-1/channels/voice",
    );
    expect(connectionSetupHref("emp-1", "whatsapp")).toBe(
      "/dashboard/employees/emp-1/channels/messaging/whatsapp",
    );
    expect(connectionSetupHref("emp-1", "email")).toBe(
      "/dashboard/employees/emp-1/channels/messaging/email",
    );
    expect(connectionSetupHref("emp-1", "telegram")).toBe(
      "/dashboard/employees/emp-1/channels/messaging/telegram",
    );
    expect(connectionSetupHref("emp-1", "slack")).toBe("/dashboard/employees/emp-1/channels/slack");
  });
});

// --- Filtering + labels -----------------------------------------------------

describe("filterConnections + labels", () => {
  it("filters by AI Employee, type, and status", async () => {
    const store = new InMemoryStore();
    await seedScalePlan(store, "org-1");
    const maya = await seedEmployee(store, "org-1", "Maya");
    const atlas = await seedEmployee(store, "org-1", "Atlas");
    await createWebChannel(store, { organizationId: "org-1", userId: "u1" }, maya, {
      name: "Maya web",
    });
    await createWebChannel(store, { organizationId: "org-1", userId: "u1" }, atlas, {
      name: "Atlas web",
    });
    const channels = await store.listEmployeeChannelsForOrganization("org-1");

    expect(filterConnections(channels, { employeeId: maya.id })).toHaveLength(1);
    expect(filterConnections(channels, { type: "website_widget" })).toHaveLength(2);
    expect(filterConnections(channels, { type: "whatsapp" })).toHaveLength(0);
    // New web channels start as draft.
    expect(filterConnections(channels, { status: "draft" })).toHaveLength(2);
    expect(filterConnections(channels, { status: "active" })).toHaveLength(0);
  });

  it("exposes friendly provider + setup-state labels", () => {
    expect(providerLabel("taurus_web")).toBe("Taurus Web");
    expect(providerLabel("meta_whatsapp_cloud")).toBe("Meta WhatsApp Cloud");
    expect(CONNECTION_SETUP_STATE_LABELS.active).toBe("Connected");
    expect(CONNECTION_SETUP_STATE_LABELS.draft).toBe("Setup in progress");
  });

  it("offers a test action only for active connections", () => {
    expect(connectionTestAvailable("active")).toBe(true);
    expect(connectionTestAvailable("draft")).toBe(false);
    expect(connectionTestAvailable("paused")).toBe(false);
  });

  it("routes the Test action to a real surface (hosted chat for web, setup page otherwise)", () => {
    // Web connections open the live hosted chat — a genuine end-to-end test.
    expect(connectionTestHref("pk_123", "emp-1", "website_widget")).toBe("/public/chat/pk_123");
    expect(connectionTestOpensLiveSurface("website_widget")).toBe(true);
    // Foundation connections open the setup page, where the simulate panel lives.
    expect(connectionTestHref("pk_123", "emp-1", "whatsapp")).toBe(
      "/dashboard/employees/emp-1/channels/messaging/whatsapp",
    );
    expect(connectionTestOpensLiveSurface("whatsapp")).toBe(false);
  });
});

// --- Permissions ------------------------------------------------------------

describe("Connections permissions", () => {
  it("lets every role view connections", () => {
    for (const role of ROLES) expect(hasPermission(role, "channel.view")).toBe(true);
  });

  it("lets owner/admin/builder manage, but not viewer", () => {
    expect(hasPermission("owner", "channel.manage")).toBe(true);
    expect(hasPermission("admin", "channel.manage")).toBe(true);
    expect(hasPermission("builder", "channel.manage")).toBe(true);
    expect(hasPermission("viewer", "channel.manage")).toBe(false);
  });
});
