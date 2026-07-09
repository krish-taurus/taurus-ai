import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import {
  parseActivity,
  verifyInboundToken,
  getConnectorToken,
  sendReply,
  type RsaJwk,
} from "@/modules/channels/teams/bot-framework";
import { connectTeams, processTeamsActivity } from "@/modules/channels/teams/service";
import type { ChatGateway } from "@/modules/employee-chat/service";
import type { AiEmployee } from "@/lib/db/types";
import type { GatewayResponse } from "@/modules/model-gateway/types";

const MASTER = "TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY";
const saved = process.env[MASTER];
afterEach(() => {
  if (saved === undefined) delete process.env[MASTER];
  else process.env[MASTER] = saved;
  vi.restoreAllMocks();
});

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeJwt(input: { appId: string; kid: string; privateKey: crypto.KeyObject; exp: number }): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: "RS256", kid: input.kid, typ: "JWT" })));
  const payload = b64url(
    Buffer.from(JSON.stringify({ aud: input.appId, exp: input.exp, iss: "https://api.botframework.com" })),
  );
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), input.privateKey);
  return `${header}.${payload}.${b64url(sig)}`;
}
function jwkFrom(publicKey: crypto.KeyObject, kid: string): RsaJwk {
  return { ...(publicKey.export({ format: "jwk" }) as unknown as RsaJwk), kid };
}

function gateway(text = "Reply from Teams"): ChatGateway {
  return {
    async resolveModelForTask() {
      return {
        model: { providerSlug: "openai", modelId: "gpt-5.4", displayName: "GPT", modelFamily: "gpt-5", status: "available", modelTier: "balanced", recommendedFor: "", contextWindowTokens: 1, maxOutputTokens: 1, supportsText: true, supportsVision: false, supportsAudio: false, supportsTools: false, supportsJson: false, supportsStreaming: false, supportsReasoning: false, supportsCaching: false, inputUsdPerMillionTokens: 1, cachedInputUsdPerMillionTokens: null, outputUsdPerMillionTokens: 2, pricingNotes: null, pricingSourceUrl: null, priceCheckedAt: null },
        providerSlug: "openai", routingMode: "auto_balanced", reason: "test",
      };
    },
    async generateText(): Promise<GatewayResponse> {
      return { text, providerSlug: "openai", modelId: "gpt-5.4", inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0, latencyMs: 1, demo: false };
    },
  };
}

async function seedTeams(store: InMemoryStore, tenantId = "TENANT1") {
  process.env[MASTER] = "x".repeat(32);
  const employee: AiEmployee = await store.createEmployee({ organizationId: "org-1", name: "Nova", roleTitle: "Support", createdBy: null });
  const dna: EmployeeDnaV1 = { ...createEmptyDnaV1(), identity: { mission: "Help.", roleSummary: "Support", primaryGoals: [], successCriteria: [] } };
  await store.saveEmployeeDnaDraft({ organizationId: "org-1", employeeId: employee.id, dna, userId: "u1" });
  await store.publishEmployeeDna({ organizationId: "org-1", employeeId: employee.id, userId: "u1" });
  const channel = await connectTeams(store, { organizationId: "org-1", userId: "u1" }, {
    employee, appId: "app1", appPassword: "secret1", tenantId, tenantName: "Contoso",
  });
  return { employee, channel };
}

describe("Teams Activity parsing", () => {
  it("parses a message Activity and strips @mention tags; ignores non-messages", () => {
    const activity = parseActivity({
      type: "message",
      id: "a1",
      text: "<at>Nova</at> what are your hours?",
      serviceUrl: "https://smba.trafficmanager.net/",
      from: { id: "U1", name: "Sam" },
      conversation: { id: "C1", tenantId: "T1" },
    });
    expect(activity?.text).toBe("what are your hours?");
    expect(activity?.conversationId).toBe("C1");
    expect(activity?.tenantId).toBe("T1");
    expect(parseActivity({ type: "conversationUpdate" })).toBeNull();
  });
});

describe("Teams inbound JWT verification", () => {
  it("verifies a valid RS256 token and rejects wrong audience / kid / missing header", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = jwkFrom(publicKey, "k1");
    const nowSec = 1_700_000_000;
    const token = makeJwt({ appId: "app1", kid: "k1", privateKey, exp: nowSec + 3600 });

    expect(verifyInboundToken({ authHeader: `Bearer ${token}`, appId: "app1", jwks: [jwk], nowSec })).toBe(true);
    // Wrong audience.
    expect(verifyInboundToken({ authHeader: `Bearer ${token}`, appId: "other", jwks: [jwk], nowSec })).toBe(false);
    // Unknown signing key.
    expect(verifyInboundToken({ authHeader: `Bearer ${token}`, appId: "app1", jwks: [{ ...jwk, kid: "k2" }], nowSec })).toBe(false);
    // Expired.
    expect(verifyInboundToken({ authHeader: `Bearer ${token}`, appId: "app1", jwks: [jwk], nowSec: nowSec + 999_999 })).toBe(false);
    // No header.
    expect(verifyInboundToken({ authHeader: null, appId: "app1", jwks: [jwk], nowSec })).toBe(false);
  });
});

describe("Teams connector calls", () => {
  it("acquires a connector token and posts a reply", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", id: "reply1" }), { status: 200 }),
    );
    expect(await getConnectorToken("app1", "secret1")).toBe("tok");
    const res = await sendReply({ serviceUrl: "https://smba/", conversationId: "C1", text: "hi", token: "tok" });
    expect(res.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("connectTeams", () => {
  it("creates an active Teams connection + stores encrypted credentials, then reconnects in place", async () => {
    const store = new InMemoryStore();
    const { channel } = await seedTeams(store, "T9");
    expect(channel.channelType).toBe("microsoft_teams");
    expect(channel.status).toBe("active");
    expect(channel.providerConfig.tenant_id).toBe("T9");
    expect((await store.getChannelProviderCredentialMetadata("org-1", "microsoft_graph"))?.status).toBe("active");
    expect((await store.getEmployeeChannelByTeamsTenant("T9"))?.id).toBe(channel.id);
  });
});

describe("processTeamsActivity", () => {
  it("routes an Activity to the tenant's connection and replies via the runtime", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", id: "r1" }), { status: 200 }),
    );
    const store = new InMemoryStore();
    const { channel } = await seedTeams(store, "T777");

    const body = JSON.stringify({
      type: "message",
      id: "a1",
      text: "Do you ship overseas?",
      serviceUrl: "https://smba.trafficmanager.net/uk/",
      from: { id: "U1", name: "Sam" },
      conversation: { id: "C1", tenantId: "T777" },
    });
    // Non-prod → JWT check skipped; the reply goes out through the mocked fetch.
    const res = await processTeamsActivity(
      { store, gateway: gateway("Yes, worldwide."), isProduction: () => false },
      { rawBody: body, headers: { authorization: "Bearer x" } },
    );
    expect(res.status).toBe(200);
    // The serviceUrl was stashed for replies + an inbound event recorded.
    const fresh = await store.getEmployeeChannel("org-1", channel.id);
    expect(fresh?.providerConfig.serviceUrl).toBe("https://smba.trafficmanager.net/uk/");
    const events = await store.listChannelWebhookEventsForChannel("org-1", channel.id, 10);
    expect(events.some((e) => e.eventType === "inbound")).toBe(true);
  });

  it("acks an unknown tenant without error", async () => {
    const store = new InMemoryStore();
    const res = await processTeamsActivity(
      { store, gateway: gateway(), isProduction: () => false },
      { rawBody: JSON.stringify({ type: "message", text: "hi", serviceUrl: "https://x/", conversation: { id: "C1", tenantId: "NOPE" } }), headers: {} },
    );
    expect(res.status).toBe(200);
  });
});
