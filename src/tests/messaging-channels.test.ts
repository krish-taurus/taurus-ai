import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { hasPermission, ROLES } from "@/modules/organizations/roles";
import {
  createMessagingChannel,
  saveProviderCredential,
  simulateInboundMessage,
  type MessagingActor,
} from "@/modules/channels/messaging/service";
import { processMessagingWebhook } from "@/modules/channels/messaging/webhook";
import {
  MESSAGING_CHANNEL_TYPES,
  providersForChannelType,
} from "@/modules/channels/messaging/catalog";
import { twilioProvider } from "@/modules/channels/messaging/providers/twilio";
import { sendgridProvider } from "@/modules/channels/messaging/providers/sendgrid-email";
import { telegramProvider } from "@/modules/channels/messaging/providers/telegram";
import { htmlToSafeText } from "@/modules/channels/messaging/html";
import { hmacBase64 } from "@/modules/channels/messaging/crypto";
import type { ChatGateway } from "@/modules/employee-chat/service";
import type { AiEmployee, EmployeeChannel } from "@/lib/db/types";
import type { GatewayRequest, GatewayResponse } from "@/modules/model-gateway/types";
import type { WebhookRequest } from "@/modules/channels/messaging/types";

const MASTER_KEY_VAR = "TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY";
const actor: MessagingActor = { organizationId: "org-1", userId: "user-1" };

async function seedEmployee(
  store: InMemoryStore,
  organizationId: string,
  overrides: Partial<AiEmployee> = {},
): Promise<AiEmployee> {
  return store.createEmployee({
    organizationId,
    name: overrides.name ?? "Nova",
    roleTitle: "Support Specialist",
    department: "Support",
    description: null,
    status: overrides.status ?? "active",
    createdBy: null,
  });
}

async function publishDna(store: InMemoryStore, organizationId: string, employeeId: string) {
  const dna: EmployeeDnaV1 = {
    ...createEmptyDnaV1(),
    identity: { mission: "Help.", roleSummary: "Support", primaryGoals: [], successCriteria: [] },
  };
  await store.saveEmployeeDnaDraft({ organizationId, employeeId, dna, userId: "user-1" });
  await store.publishEmployeeDna({ organizationId, employeeId, userId: "user-1" });
}

function fakeGateway(text = "Thanks for reaching out!"): {
  gateway: ChatGateway;
  calls: GatewayRequest[];
} {
  const calls: GatewayRequest[] = [];
  const gateway: ChatGateway = {
    async resolveModelForTask() {
      return {
        model: {
          providerSlug: "openai",
          modelId: "gpt-5.4",
          displayName: "GPT-5.4",
          modelFamily: "gpt-5",
          status: "available",
          modelTier: "balanced",
          recommendedFor: "",
          contextWindowTokens: 400_000,
          maxOutputTokens: 128_000,
          supportsText: true,
          supportsVision: false,
          supportsAudio: false,
          supportsTools: false,
          supportsJson: false,
          supportsStreaming: false,
          supportsReasoning: false,
          supportsCaching: false,
          inputUsdPerMillionTokens: 1,
          cachedInputUsdPerMillionTokens: null,
          outputUsdPerMillionTokens: 2,
          pricingNotes: null,
          pricingSourceUrl: null,
          priceCheckedAt: null,
        },
        providerSlug: "openai",
        routingMode: "auto_balanced",
        reason: "test",
      };
    },
    async generateText(request): Promise<GatewayResponse> {
      calls.push(request);
      return {
        text,
        providerSlug: "openai",
        modelId: "gpt-5.4",
        inputTokens: 30,
        outputTokens: 8,
        estimatedCostUsd: 0.0001,
        latencyMs: 2,
        demo: false,
      };
    },
  };
  return { gateway, calls };
}

async function seedActiveSmsChannel(store: InMemoryStore): Promise<EmployeeChannel> {
  const employee = await seedEmployee(store, "org-1");
  await publishDna(store, "org-1", employee.id);
  const channel = await createMessagingChannel(store, actor, employee, {
    channelType: "sms",
    provider: "twilio",
    name: "SMS",
    senderId: "+15550000000",
  });
  await store.activateEmployeeChannel("org-1", channel.id);
  return (await store.getEmployeeChannel("org-1", channel.id))!;
}

afterEach(() => {
  delete process.env[MASTER_KEY_VAR];
});

// --- Catalog metadata -------------------------------------------------------

describe("Messaging catalog", () => {
  it("supports whatsapp, sms, email and telegram with the right providers", () => {
    expect(MESSAGING_CHANNEL_TYPES).toEqual(["whatsapp", "sms", "email", "telegram"]);
    expect(providersForChannelType("whatsapp")).toContain("twilio");
    expect(providersForChannelType("whatsapp")).toContain("meta_whatsapp_cloud");
    expect(providersForChannelType("sms")).toContain("twilio");
    expect(providersForChannelType("email")).toContain("sendgrid");
    expect(providersForChannelType("email")).toContain("mailgun");
    expect(providersForChannelType("telegram")).toEqual(["telegram"]);
  });
});

// --- Channel management + isolation -----------------------------------------

describe("Messaging channel management", () => {
  it("creates a messaging channel (draft) with an opaque public key", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    const channel = await createMessagingChannel(store, actor, employee, {
      channelType: "whatsapp",
      provider: "twilio",
      name: "WhatsApp",
    });
    expect(channel.status).toBe("draft");
    expect(channel.channelType).toBe("whatsapp");
    expect(channel.channelProvider).toBe("twilio");
    expect(channel.publicKey.startsWith("tc_")).toBe(true);
  });

  it("rejects a provider that does not support the channel type", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    await expect(
      createMessagingChannel(store, actor, employee, {
        channelType: "email",
        provider: "twilio",
        name: "Bad",
      }),
    ).rejects.toThrow();
  });

  it("keeps channels and credentials organization-scoped", async () => {
    const store = new InMemoryStore();
    const channel = await seedActiveSmsChannel(store);
    expect(await store.getEmployeeChannel("org-1", channel.id)).toBeTruthy();
    expect(await store.getEmployeeChannel("org-2", channel.id)).toBeNull();

    await store.createChannelProviderCredential({
      organizationId: "org-1",
      providerType: "twilio",
      credentialMode: "bring_your_own_key",
      encryptedCredentials: "enc",
      keyLastFour: "1234",
    });
    expect(await store.getChannelProviderCredentialMetadata("org-1", "twilio")).toBeTruthy();
    expect(await store.getChannelProviderCredentialMetadata("org-2", "twilio")).toBeNull();
  });
});

describe("Messaging permissions", () => {
  it("restricts messaging management to owner/admin, testing to owner/admin/builder", () => {
    expect(hasPermission("owner", "messaging_channel.manage")).toBe(true);
    expect(hasPermission("admin", "messaging_channel.manage")).toBe(true);
    expect(hasPermission("builder", "messaging_channel.manage")).toBe(false);
    expect(hasPermission("viewer", "messaging_channel.manage")).toBe(false);
    // Simulated testing reuses channel.manage.
    expect(hasPermission("builder", "channel.manage")).toBe(true);
    for (const role of ROLES) expect(hasPermission(role, "channel.view")).toBe(true);
  });
});

// --- Simulated inbound flow -------------------------------------------------

describe("Simulated inbound flow", () => {
  it("creates a conversation + messages and generates a reply via the gateway", async () => {
    const store = new InMemoryStore();
    const channel = await seedActiveSmsChannel(store);
    const { gateway, calls } = fakeGateway("How can I help?");

    const result = await simulateInboundMessage({ store, gateway }, channel, {
      from: "+15551234567",
      text: "Hi there",
    });

    expect(result.status).toBe("processed");
    expect(calls).toHaveLength(1);
    expect(calls[0].taskType).toBe("employee_chat");
    expect(result.outboundStatus).toBe("simulated");

    // A conversation thread + user/assistant messages exist.
    const thread = await store.getLatestEmployeeChatThreadForEmployee("org-1", channel.employeeId);
    expect(thread).toBeTruthy();
    const messages = await store.listEmployeeChatMessages("org-1", thread!.id);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages[1].content).toBe("How can I help?");
  });

  it("blocks generation when the employee has no published DNA", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1"); // no DNA published
    const channel = await createMessagingChannel(store, actor, employee, {
      channelType: "sms",
      provider: "twilio",
      name: "SMS",
    });
    await store.activateEmployeeChannel("org-1", channel.id);
    const active = (await store.getEmployeeChannel("org-1", channel.id))!;
    const { gateway, calls } = fakeGateway();

    const result = await simulateInboundMessage({ store, gateway }, active, {
      from: "+1555",
      text: "Hi",
    });
    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("needs_dna");
    expect(calls).toHaveLength(0);
  });

  it("rejects an archived employee", async () => {
    const store = new InMemoryStore();
    const channel = await seedActiveSmsChannel(store);
    await store.updateEmployee("org-1", channel.employeeId, { status: "archived" });
    const { gateway } = fakeGateway();
    const result = await simulateInboundMessage({ store, gateway }, channel, {
      from: "+1555",
      text: "Hi",
    });
    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("employee_unavailable");
  });

  it("rejects an inactive channel", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", employee.id);
    const channel = await createMessagingChannel(store, actor, employee, {
      channelType: "sms",
      provider: "twilio",
      name: "SMS",
    });
    // Not activated (draft).
    const { gateway } = fakeGateway();
    const result = await simulateInboundMessage({ store, gateway }, channel, {
      from: "+1555",
      text: "Hi",
    });
    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("inactive");
  });

  it("does not make external calls and records metadata-only events", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = new InMemoryStore();
    const channel = await seedActiveSmsChannel(store);
    const { gateway } = fakeGateway();

    await simulateInboundMessage({ store, gateway }, channel, {
      from: "+15551234567",
      text: "SECRET-INBOUND-QUESTION-99",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    const events = await store.listChannelWebhookEventsForChannel("org-1", channel.id);
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain("SECRET-INBOUND-QUESTION-99");
    const audits = store._auditEvents();
    expect(JSON.stringify(audits)).not.toContain("SECRET-INBOUND-QUESTION-99");
    fetchSpy.mockRestore();
  });
});

// --- Credentials ------------------------------------------------------------

describe("Provider credentials", () => {
  it("refuses to save BYOK when encryption is not configured", async () => {
    delete process.env[MASTER_KEY_VAR];
    const store = new InMemoryStore();
    await expect(
      saveProviderCredential(store, actor, "twilio", { accountSid: "AC", authToken: "tok" }, null),
    ).rejects.toThrow();
  });

  it("encrypts credentials and never returns plaintext", async () => {
    process.env[MASTER_KEY_VAR] = "unit-test-channel-master-key-123";
    const store = new InMemoryStore();
    await saveProviderCredential(
      store,
      actor,
      "twilio",
      { accountSid: "AC123", authToken: "super-secret-token-4242" },
      "Prod",
    );

    const meta = await store.getChannelProviderCredentialMetadata("org-1", "twilio");
    expect(meta?.keyLastFour).toBe("4242");
    expect(JSON.stringify(meta)).not.toContain("super-secret-token-4242");
    expect((meta as unknown as Record<string, unknown>).encryptedCredentials).toBeUndefined();

    const encrypted = await store.getChannelProviderEncryptedCredentials("org-1", "twilio");
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain("super-secret-token-4242");

    expect(JSON.stringify(store._auditEvents())).not.toContain("super-secret-token-4242");
  });
});

// --- Provider adapters ------------------------------------------------------

describe("Twilio adapter", () => {
  it("parses an inbound SMS and a delivery status", () => {
    const inbound = twilioProvider.parseInboundWebhook({
      method: "POST",
      url: "https://x",
      headers: {},
      query: {},
      rawBody: "",
      form: { From: "+15551112222", To: "+15550000000", Body: "hello", MessageSid: "SM1" },
      json: null,
    });
    expect(inbound?.channelType).toBe("sms");
    expect(inbound?.messageText).toBe("hello");
    expect(inbound?.senderExternalId).toBe("+15551112222");

    const delivery = twilioProvider.parseDeliveryStatus({
      method: "POST",
      url: "https://x",
      headers: {},
      query: {},
      rawBody: "",
      form: { MessageStatus: "delivered", MessageSid: "SM1" },
      json: null,
    });
    expect(delivery?.deliveryStatus).toBe("delivered");
  });

  it("verifies a valid Twilio signature and rejects an invalid one", async () => {
    const url = "https://app/api/webhooks/channels/twilio/tc_abc";
    const form = { From: "+1555", To: "+1999", Body: "hi", MessageSid: "SM1" };
    const data = Object.keys(form)
      .sort()
      .reduce((acc, k) => acc + k + (form as Record<string, string>)[k], url);
    const signature = await hmacBase64("SHA-1", "authtoken", data);
    const req: WebhookRequest = {
      method: "POST",
      url,
      headers: { "x-twilio-signature": signature },
      query: {},
      rawBody: "",
      form,
      json: null,
    };
    const config = {
      mode: "live" as const,
      secrets: { authToken: "authtoken" },
      channelConfig: {},
    };

    expect((await twilioProvider.verifyWebhook(req, config)).verified).toBe(true);
    expect(
      (
        await twilioProvider.verifyWebhook(
          { ...req, headers: { "x-twilio-signature": "wrong" } },
          config,
        )
      ).verified,
    ).toBe(false);
  });
});

describe("Telegram adapter", () => {
  const update = {
    update_id: 1,
    message: {
      message_id: 42,
      from: { id: 555, first_name: "Ada", username: "ada" },
      chat: { id: 555, type: "private" },
      date: 1_700_000_000,
      text: "Hi there",
    },
  };

  it("parses an inbound Telegram text message from the JSON body", () => {
    const inbound = telegramProvider.parseInboundWebhook({
      method: "POST",
      url: "https://x",
      headers: {},
      query: {},
      rawBody: JSON.stringify(update),
      form: {},
      json: update,
    });
    expect(inbound?.channelType).toBe("telegram");
    expect(inbound?.messageText).toBe("Hi there");
    expect(inbound?.senderExternalId).toBe("555");
    expect(inbound?.senderLabel).toBe("Ada");
    expect(
      telegramProvider.parseDeliveryStatus({
        method: "POST",
        url: "https://x",
        headers: {},
        query: {},
        rawBody: "",
        form: {},
        json: update,
      }),
    ).toBeNull();
  });

  it("ignores non-text updates (edits, joins, callbacks)", () => {
    const edited = { edited_message: update.message };
    expect(
      telegramProvider.parseInboundWebhook({
        method: "POST",
        url: "https://x",
        headers: {},
        query: {},
        rawBody: "",
        form: {},
        json: edited,
      }),
    ).toBeNull();
  });

  it("verifies the secret token when configured, and treats the URL as the secret otherwise", async () => {
    const base: WebhookRequest = {
      method: "POST",
      url: "https://x",
      headers: { "x-telegram-bot-api-secret-token": "s3cret" },
      query: {},
      rawBody: "",
      form: {},
      json: update,
    };
    const withSecret = { mode: "live" as const, secrets: { botToken: "t", webhookSecret: "s3cret" }, channelConfig: {} };
    expect((await telegramProvider.verifyWebhook(base, withSecret)).verified).toBe(true);
    expect(
      (await telegramProvider.verifyWebhook({ ...base, headers: { "x-telegram-bot-api-secret-token": "wrong" } }, withSecret)).verified,
    ).toBe(false);
    // No secret configured → accepted (the unguessable webhook URL is the secret).
    const noSecret = { mode: "live" as const, secrets: { botToken: "t" }, channelConfig: {} };
    expect((await telegramProvider.verifyWebhook({ ...base, headers: {} }, noSecret)).verified).toBe(true);
  });

  it("reports simulated mode without a bot token and live with one", () => {
    expect(telegramProvider.getProviderStatus({ mode: "simulated", secrets: {}, channelConfig: {} }).mode).toBe(
      "simulated",
    );
    expect(
      telegramProvider.getProviderStatus({ mode: "live", secrets: { botToken: "t" }, channelConfig: {} }).mode,
    ).toBe("live");
  });
});

describe("Email safety", () => {
  it("strips HTML to safe text (no tags, no scripts)", () => {
    const out = htmlToSafeText("<p>Hello <b>world</b></p><script>alert(1)</script>");
    expect(out).toContain("Hello");
    expect(out).toContain("world");
    expect(out).not.toContain("<");
    expect(out.toLowerCase()).not.toContain("alert(1)");
  });

  it("SendGrid inbound parses HTML-only email into safe text", () => {
    const inbound = sendgridProvider.parseInboundWebhook({
      method: "POST",
      url: "https://x",
      headers: {},
      query: {},
      rawBody: "",
      form: {
        from: "Jane <jane@example.com>",
        to: "help@acme.com",
        subject: "Hi",
        html: "<b>Hi team</b>",
      },
      json: null,
    });
    expect(inbound?.senderExternalId).toBe("jane@example.com");
    expect(inbound?.messageText).not.toContain("<");
    expect(inbound?.contentType).toBe("email");
  });
});

// --- Delivery status store logic --------------------------------------------

describe("Delivery status", () => {
  it("updates a webhook event's status", async () => {
    const store = new InMemoryStore();
    const event = await store.createChannelWebhookEvent({
      organizationId: "org-1",
      channelId: "chan-1",
      providerType: "twilio",
      eventType: "delivery_status",
      externalEventId: "SM1",
      status: "received",
    });
    const updated = await store.updateChannelWebhookEventStatus(event.id, {
      status: "processed",
      processedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(updated?.status).toBe("processed");
    expect(updated?.processedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

// --- Webhook route integration ----------------------------------------------

describe("Messaging webhook processing", () => {
  it("resolves the channel by public key and runs the runtime (Twilio inbound)", async () => {
    const store = new InMemoryStore();
    const channel = await seedActiveSmsChannel(store);
    const { gateway, calls } = fakeGateway("Reply from Nova");

    const request: WebhookRequest = {
      method: "POST",
      url: `https://app/api/webhooks/channels/twilio/${channel.publicKey}`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      query: {},
      rawBody: "",
      form: {
        From: "+15551234567",
        To: "+15550000000",
        Body: "Do you ship internationally?",
        MessageSid: "SM99",
      },
      json: null,
    };

    const result = await processMessagingWebhook(
      { store, gateway, isProduction: () => false },
      { providerSlug: "twilio", publicKey: channel.publicKey, request },
    );
    expect(result.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("runs the runtime for a Telegram JSON webhook (no secret needed)", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", employee.id);
    const channel = await createMessagingChannel(store, actor, employee, {
      channelType: "telegram",
      provider: "telegram",
      name: "Telegram",
    });
    await store.activateEmployeeChannel("org-1", channel.id);
    const active = (await store.getEmployeeChannel("org-1", channel.id))!;
    const { gateway, calls } = fakeGateway("Hello from Nova");

    const update = {
      update_id: 7,
      message: {
        message_id: 1,
        from: { id: 999, first_name: "Sam" },
        chat: { id: 999, type: "private" },
        date: 1_700_000_000,
        text: "Are you open on weekends?",
      },
    };
    const request: WebhookRequest = {
      method: "POST",
      url: `https://app/api/webhooks/channels/telegram/${active.publicKey}`,
      headers: { "content-type": "application/json" },
      query: {},
      rawBody: JSON.stringify(update),
      form: {},
      json: update,
    };
    // No token → simulated mode; no secret configured → verification passes.
    const result = await processMessagingWebhook(
      { store, gateway, isProduction: () => false },
      { providerSlug: "telegram", publicKey: active.publicKey, request },
    );
    expect(result.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("returns 404 for an unknown public key without leaking org data", async () => {
    const store = new InMemoryStore();
    const { gateway } = fakeGateway();
    const request: WebhookRequest = {
      method: "POST",
      url: "https://app/api/webhooks/channels/twilio/tc_missing",
      headers: {},
      query: {},
      rawBody: "",
      form: { From: "+1", Body: "hi", MessageSid: "SM1" },
      json: null,
    };
    const result = await processMessagingWebhook(
      { store, gateway, isProduction: () => false },
      { providerSlug: "twilio", publicKey: "tc_missing", request },
    );
    expect(result.status).toBe(404);
  });
});
