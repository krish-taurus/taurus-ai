import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import {
  isWhatsAppEmbeddedSignupConfigured,
  exchangeCode,
  getPhoneNumber,
  connectWhatsApp,
} from "@/modules/channels/whatsapp/connect";
import type { AiEmployee } from "@/lib/db/types";

const ENV = [
  "NEXT_PUBLIC_WHATSAPP_APP_ID",
  "NEXT_PUBLIC_WHATSAPP_CONFIG_ID",
  "WHATSAPP_APP_SECRET",
  "TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY",
] as const;
const saved: Record<string, string | undefined> = {};
for (const k of ENV) saved[k] = process.env[k];
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

function configureApp() {
  process.env.NEXT_PUBLIC_WHATSAPP_APP_ID = "app123";
  process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID = "cfg123";
  process.env.WHATSAPP_APP_SECRET = "secret123";
}

async function seedEmployee(store: InMemoryStore): Promise<AiEmployee> {
  const employee = await store.createEmployee({
    organizationId: "org-1",
    name: "Nova",
    roleTitle: "Support",
    createdBy: null,
  });
  const dna: EmployeeDnaV1 = {
    ...createEmptyDnaV1(),
    identity: { mission: "Help.", roleSummary: "Support", primaryGoals: [], successCriteria: [] },
  };
  await store.saveEmployeeDnaDraft({ organizationId: "org-1", employeeId: employee.id, dna, userId: "u1" });
  await store.publishEmployeeDna({ organizationId: "org-1", employeeId: employee.id, userId: "u1" });
  return employee;
}

function mockFetchJson(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

describe("WhatsApp Embedded Signup config", () => {
  it("requires the app id, config id, and secret", () => {
    expect(isWhatsAppEmbeddedSignupConfigured()).toBe(false);
    configureApp();
    expect(isWhatsAppEmbeddedSignupConfigured()).toBe(true);
    delete process.env.WHATSAPP_APP_SECRET;
    expect(isWhatsAppEmbeddedSignupConfigured()).toBe(false);
  });
});

describe("WhatsApp code exchange + number lookup", () => {
  it("exchanges a code for a business access token", async () => {
    configureApp();
    mockFetchJson(200, { access_token: "EAAG_token" });
    expect(await exchangeCode("the_code")).toBe("EAAG_token");
  });

  it("surfaces a Meta error on a failed exchange", async () => {
    configureApp();
    mockFetchJson(400, { error: { message: "Invalid code" } });
    await expect(exchangeCode("bad")).rejects.toThrow("Invalid code");
  });

  it("reads a number's display details, with safe defaults on failure", async () => {
    mockFetchJson(200, { display_phone_number: "+1 555-000-1234", verified_name: "Acme" });
    expect(await getPhoneNumber("tok", "PN1")).toEqual({
      phoneNumberId: "PN1",
      displayPhoneNumber: "+1 555-000-1234",
      verifiedName: "Acme",
    });
    mockFetchJson(500, { error: { message: "boom" } });
    expect(await getPhoneNumber("tok", "PN2")).toEqual({
      phoneNumberId: "PN2",
      displayPhoneNumber: null,
      verifiedName: null,
    });
  });
});

describe("connectWhatsApp", () => {
  it("creates an active WhatsApp connection + stores encrypted credentials, then reconnects in place", async () => {
    configureApp();
    process.env.TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY = "x".repeat(32);
    const store = new InMemoryStore();
    const employee = await seedEmployee(store);

    const channel = await connectWhatsApp(
      store,
      { organizationId: "org-1", userId: "u1" },
      {
        employee,
        token: "EAAG_token",
        number: { phoneNumberId: "PN1", displayPhoneNumber: "+15550001234", verifiedName: "Acme" },
      },
    );
    expect(channel.channelType).toBe("whatsapp");
    expect(channel.channelProvider).toBe("meta_whatsapp_cloud");
    expect(channel.status).toBe("active");
    expect(channel.providerConfig.senderId).toBe("+15550001234");
    expect(channel.providerConfig.phoneNumberId).toBe("PN1");

    // Encrypted credentials are stored for the provider (never in plaintext here).
    const cred = await store.getChannelProviderCredentialMetadata("org-1", "meta_whatsapp_cloud");
    expect(cred?.status).toBe("active");

    // Reconnecting a new number updates the same connection, not a duplicate.
    const again = await connectWhatsApp(
      store,
      { organizationId: "org-1", userId: "u1" },
      {
        employee,
        token: "EAAG_token2",
        number: { phoneNumberId: "PN2", displayPhoneNumber: "+15559998888", verifiedName: "Acme" },
      },
    );
    expect(again.id).toBe(channel.id);
    expect(again.providerConfig.phoneNumberId).toBe("PN2");
    const all = (await store.listEmployeeChannelsForEmployee("org-1", employee.id)).filter(
      (c) => c.channelType === "whatsapp" && c.status !== "archived",
    );
    expect(all).toHaveLength(1);
  });
});
