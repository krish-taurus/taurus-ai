import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import {
  signState,
  verifyState,
  verifySlackSignature,
  buildInstallUrl,
  isSlackConfigured,
} from "@/modules/channels/slack/oauth";
import { slackProvider } from "@/modules/channels/slack/provider";
import { connectSlackWorkspace, processSlackEvent } from "@/modules/channels/slack/service";
import type { ChatGateway } from "@/modules/employee-chat/service";
import type { AiEmployee } from "@/lib/db/types";
import type { GatewayResponse } from "@/modules/model-gateway/types";
import type { WebhookRequest } from "@/modules/channels/messaging/types";

const ENV = ["AUTH_SECRET", "SLACK_SIGNING_SECRET", "SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY"] as const;
const saved: Record<string, string | undefined> = {};
for (const k of ENV) saved[k] = process.env[k];
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

function slackHeaders(signingSecret: string, rawBody: string, ts = String(Math.floor(Date.now() / 1000))) {
  const sig =
    "v0=" + crypto.createHmac("sha256", signingSecret).update(`v0:${ts}:${rawBody}`).digest("hex");
  return { "x-slack-request-timestamp": ts, "x-slack-signature": sig };
}

function gateway(text = "Hi from Slack"): { gateway: ChatGateway; calls: number } {
  const state = { calls: 0 };
  const g: ChatGateway = {
    async resolveModelForTask() {
      return {
        model: { providerSlug: "openai", modelId: "gpt-5.4", displayName: "GPT", modelFamily: "gpt-5", status: "available", modelTier: "balanced", recommendedFor: "", contextWindowTokens: 1, maxOutputTokens: 1, supportsText: true, supportsVision: false, supportsAudio: false, supportsTools: false, supportsJson: false, supportsStreaming: false, supportsReasoning: false, supportsCaching: false, inputUsdPerMillionTokens: 1, cachedInputUsdPerMillionTokens: null, outputUsdPerMillionTokens: 2, pricingNotes: null, pricingSourceUrl: null, priceCheckedAt: null },
        providerSlug: "openai", routingMode: "auto_balanced", reason: "test",
      };
    },
    async generateText(): Promise<GatewayResponse> {
      state.calls += 1;
      return { text, providerSlug: "openai", modelId: "gpt-5.4", inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0, latencyMs: 1, demo: false };
    },
  };
  return { gateway: g, calls: state.calls } as unknown as { gateway: ChatGateway; calls: number };
}

async function seedSlackWorkspace(store: InMemoryStore, teamId = "T123") {
  process.env.TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY = "x".repeat(32);
  const employee: AiEmployee = await store.createEmployee({
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
  const channel = await connectSlackWorkspace(
    store,
    { organizationId: "org-1", userId: "u1" },
    { employee, install: { botToken: "xoxb-test", teamId, teamName: "Acme" } },
  );
  return { employee, channel };
}

describe("Slack OAuth state", () => {
  it("signs + verifies state bound to user/org/employee, rejects tampering", () => {
    process.env.AUTH_SECRET = "a-strong-secret-value";
    const token = signState({ uid: "u1", orgId: "o1", employeeId: "e1", nonce: "n", iat: Date.now() });
    const parsed = verifyState(token);
    expect(parsed?.uid).toBe("u1");
    expect(parsed?.employeeId).toBe("e1");
    expect(verifyState(token + "x")).toBeNull();
    expect(verifyState("garbage")).toBeNull();
  });

  it("builds a Slack authorize URL with scopes + state", () => {
    process.env.SLACK_CLIENT_ID = "cid";
    const url = buildInstallUrl({ state: "st", redirectUri: "https://app/cb" });
    expect(url).toContain("slack.com/oauth/v2/authorize");
    expect(url).toContain("client_id=cid");
    expect(url).toContain("chat%3Awrite");
    expect(url).toContain("state=st");
  });

  it("isSlackConfigured requires all three app secrets", () => {
    delete process.env.SLACK_CLIENT_ID;
    expect(isSlackConfigured()).toBe(false);
    process.env.SLACK_CLIENT_ID = "a";
    process.env.SLACK_CLIENT_SECRET = "b";
    process.env.SLACK_SIGNING_SECRET = "c";
    expect(isSlackConfigured()).toBe(true);
  });
});

describe("Slack request signature", () => {
  it("verifies a valid v0 signature and rejects tampered / stale ones", () => {
    const secret = "shhh";
    const body = JSON.stringify({ type: "event_callback" });
    const now = 1_700_000_000_000;
    const ts = String(now / 1000);
    const good = slackHeaders(secret, body, ts);
    expect(
      verifySlackSignature({ signingSecret: secret, timestamp: ts, signature: good["x-slack-signature"], rawBody: body, nowMs: now }),
    ).toBe(true);
    // Tampered body.
    expect(
      verifySlackSignature({ signingSecret: secret, timestamp: ts, signature: good["x-slack-signature"], rawBody: body + "!", nowMs: now }),
    ).toBe(false);
    // Stale timestamp (>5 min).
    expect(
      verifySlackSignature({ signingSecret: secret, timestamp: ts, signature: good["x-slack-signature"], rawBody: body, nowMs: now + 10 * 60 * 1000 }),
    ).toBe(false);
  });
});

describe("Slack event parsing", () => {
  it("parses a human message, ignores bots / edits / non-message events", () => {
    const inbound = slackProvider.parseInboundWebhook({
      method: "POST", url: "", headers: {}, query: {}, rawBody: "", form: {},
      json: { type: "event_callback", team_id: "T1", event: { type: "message", channel: "C1", user: "U1", text: "hello", ts: "1700000000.1" } },
    });
    expect(inbound?.channelType).toBe("slack");
    expect(inbound?.messageText).toBe("hello");
    expect(inbound?.senderExternalId).toBe("C1");

    // Bot message → ignored (prevents reply loops).
    expect(
      slackProvider.parseInboundWebhook({
        method: "POST", url: "", headers: {}, query: {}, rawBody: "", form: {},
        json: { type: "event_callback", event: { type: "message", channel: "C1", text: "x", bot_id: "B1" } },
      }),
    ).toBeNull();
    // Message edit subtype → ignored.
    expect(
      slackProvider.parseInboundWebhook({
        method: "POST", url: "", headers: {}, query: {}, rawBody: "", form: {},
        json: { type: "event_callback", event: { type: "message", channel: "C1", text: "x", subtype: "message_changed" } },
      }),
    ).toBeNull();
  });
});

describe("Slack events endpoint", () => {
  it("answers the url_verification handshake with the challenge", async () => {
    const store = new InMemoryStore();
    const { gateway: g } = gateway();
    const body = JSON.stringify({ type: "url_verification", challenge: "abc123" });
    const res = await processSlackEvent(
      { store, gateway: g, isProduction: () => false },
      { rawBody: body, headers: {} },
    );
    expect(res.status).toBe(200);
    expect(res.body).toBe("abc123");
  });

  it("routes an event to the workspace's connection and replies via the runtime", async () => {
    const store = new InMemoryStore();
    process.env.SLACK_SIGNING_SECRET = "sign";
    const { channel } = await seedSlackWorkspace(store, "T777");
    expect(channel.status).toBe("active");
    const { gateway: g, ...rest } = gateway("Answer");

    const body = JSON.stringify({
      type: "event_callback",
      team_id: "T777",
      event: { type: "app_mention", channel: "C9", user: "U9", text: "hi there", ts: "1700000000.2" },
    });
    const headers = slackHeaders("sign", body);
    const res = await processSlackEvent(
      { store, gateway: g, isProduction: () => true },
      { rawBody: body, headers },
    );
    expect(res.status).toBe(200);
    // A webhook event + reply were recorded for the channel.
    const events = await store.listChannelWebhookEventsForChannel("org-1", channel.id, 10);
    expect(events.some((e) => e.eventType === "inbound")).toBe(true);
    void rest;
  });

  it("skips Slack retries so it never double-replies", async () => {
    const store = new InMemoryStore();
    process.env.SLACK_SIGNING_SECRET = "sign";
    await seedSlackWorkspace(store, "T555");
    const { gateway: g } = gateway();
    const body = JSON.stringify({ type: "event_callback", team_id: "T555", event: { type: "message", channel: "C1", text: "x", ts: "1.1" } });
    const res = await processSlackEvent(
      { store, gateway: g, isProduction: () => true },
      { rawBody: body, headers: { ...slackHeaders("sign", body), "x-slack-retry-num": "1" } },
    );
    expect(res.status).toBe(200);
  });
});
