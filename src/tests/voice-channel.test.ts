import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { hasPermission, ROLES } from "@/modules/organizations/roles";
import {
  createVoiceChannel,
  saveVoiceProviderCredential,
  type VoiceActor,
} from "@/modules/voice-runtime/service";
import {
  endSimulatedCall,
  sendSimulatedUtterance,
  startSimulatedCall,
} from "@/modules/voice-runtime/simulated-call";
import { processVoiceWebhook } from "@/modules/voice-runtime/webhook";
import { VOICE_PROVIDER_TYPES } from "@/modules/voice-runtime/catalog";
import { twilioVoiceProvider } from "@/modules/voice-runtime/providers/twilio-voice";
import type { ChatGateway } from "@/modules/employee-chat/service";
import type { AiEmployee, EmployeeChannel } from "@/lib/db/types";
import type { GatewayRequest, GatewayResponse } from "@/modules/model-gateway/types";
import type { WebhookRequest } from "@/modules/channels/messaging/types";

const MASTER_KEY_VAR = "TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY";
const actor: VoiceActor = { organizationId: "org-1", userId: "user-1" };

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

function fakeGateway(text = "Sure, I can help with that."): {
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
        inputTokens: 20,
        outputTokens: 6,
        estimatedCostUsd: 0.0001,
        latencyMs: 2,
        demo: false,
      };
    },
  };
  return { gateway, calls };
}

async function seedActiveVoiceChannel(store: InMemoryStore): Promise<EmployeeChannel> {
  const employee = await seedEmployee(store, "org-1");
  await publishDna(store, "org-1", employee.id);
  const channel = await createVoiceChannel(store, actor, employee, {
    name: "Phone",
    provider: "simulated_voice",
    phoneNumber: "+15550000000",
    phoneNumberLabel: "Main line",
    welcomeMessage: "Hi, thanks for calling!",
    voiceStyle: "Professional",
    sttProvider: "simulated_stt",
    ttsProvider: "simulated_tts",
    recordingSetting: "disabled",
    transcriptSetting: "save_transcript",
  });
  await store.activateEmployeeChannel("org-1", channel.id);
  return (await store.getEmployeeChannel("org-1", channel.id))!;
}

afterEach(() => {
  delete process.env[MASTER_KEY_VAR];
});

// --- Metadata ---------------------------------------------------------------

describe("Voice metadata", () => {
  it("supports the phone_call channel + voice provider types", () => {
    expect(VOICE_PROVIDER_TYPES).toContain("twilio_voice");
    expect(VOICE_PROVIDER_TYPES).toContain("telnyx_voice");
    expect(VOICE_PROVIDER_TYPES).toContain("vonage_voice");
    expect(VOICE_PROVIDER_TYPES).toContain("simulated_voice");
  });

  it("creates a phone_call channel (draft) + phone number", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    const channel = await createVoiceChannel(store, actor, employee, {
      name: "Phone",
      provider: "simulated_voice",
      phoneNumber: "+15550000000",
      voiceStyle: "Warm",
      sttProvider: "simulated_stt",
      ttsProvider: "simulated_tts",
      recordingSetting: "disabled",
      transcriptSetting: "save_transcript",
    });
    expect(channel.channelType).toBe("phone_call");
    expect(channel.channelProvider).toBe("simulated_voice");
    expect(channel.status).toBe("draft");
    const numbers = await store.listVoicePhoneNumbersForChannel("org-1", channel.id);
    expect(numbers).toHaveLength(1);
    expect(numbers[0].phoneNumber).toBe("+15550000000");
  });
});

describe("Voice permissions", () => {
  it("restricts management to owner/admin, testing to owner/admin/builder, view to all", () => {
    expect(hasPermission("owner", "messaging_channel.manage")).toBe(true);
    expect(hasPermission("admin", "messaging_channel.manage")).toBe(true);
    expect(hasPermission("builder", "messaging_channel.manage")).toBe(false);
    expect(hasPermission("builder", "channel.manage")).toBe(true);
    for (const role of ROLES) expect(hasPermission(role, "channel.view")).toBe(true);
  });
});

// --- Simulated call flow ----------------------------------------------------

describe("Simulated phone call", () => {
  it("creates a call session + transcript and generates a reply via the runtime", async () => {
    const store = new InMemoryStore();
    const channel = await seedActiveVoiceChannel(store);
    const { gateway, calls } = fakeGateway("Our return policy is 30 days.");

    const started = await startSimulatedCall({ store, gateway }, { channel, from: "+15551234567" });
    expect(started.status).toBe("started");
    const call = started.callSession!;
    expect(call.status).toBe("active");
    // caller number is hashed, never stored raw.
    expect(call.callerHash).toBeTruthy();
    expect(JSON.stringify(call)).not.toContain("+15551234567");

    const employee = (await store.getEmployee("org-1", channel.employeeId))!;
    const turn = await sendSimulatedUtterance(
      { store, gateway },
      { channel, employee, callSession: call, text: "What's your return policy?" },
    );
    expect(turn.status).toBe("answered");
    expect(turn.replyText).toBe("Our return policy is 30 days.");
    expect(calls).toHaveLength(1);
    expect(calls[0].taskType).toBe("employee_chat");

    const transcript = await store.listVoiceTranscriptMessages("org-1", call.id);
    // greeting (employee) + caller + employee reply.
    expect(transcript.map((m) => m.speakerType)).toEqual(["employee", "caller", "employee"]);
    expect(transcript[2].content).toBe("Our return policy is 30 days.");

    const ended = await endSimulatedCall({ store, gateway }, { channel, callSession: call });
    expect(ended?.status).toBe("completed");
    expect(ended?.durationSeconds).not.toBeNull();
  });

  it("blocks a call when Employee DNA is not published", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1"); // no DNA
    const channel = await createVoiceChannel(store, actor, employee, {
      name: "Phone",
      provider: "simulated_voice",
      voiceStyle: "Professional",
      sttProvider: "simulated_stt",
      ttsProvider: "simulated_tts",
      recordingSetting: "disabled",
      transcriptSetting: "save_transcript",
    });
    await store.activateEmployeeChannel("org-1", channel.id);
    const active = (await store.getEmployeeChannel("org-1", channel.id))!;
    const { gateway, calls } = fakeGateway();

    const started = await startSimulatedCall(
      { store, gateway },
      { channel: active, from: "+1555" },
    );
    expect(started.status).toBe("rejected");
    expect(started.reason).toBe("needs_dna");
    expect(calls).toHaveLength(0);
  });

  it("blocks a call for an archived employee", async () => {
    const store = new InMemoryStore();
    const channel = await seedActiveVoiceChannel(store);
    await store.updateEmployee("org-1", channel.employeeId, { status: "archived" });
    const { gateway } = fakeGateway();
    const started = await startSimulatedCall({ store, gateway }, { channel, from: "+1555" });
    expect(started.status).toBe("rejected");
    expect(started.reason).toBe("employee_unavailable");
  });

  it("rejects a call on an inactive channel", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", employee.id);
    const channel = await createVoiceChannel(store, actor, employee, {
      name: "Phone",
      provider: "simulated_voice",
      voiceStyle: "Professional",
      sttProvider: "simulated_stt",
      ttsProvider: "simulated_tts",
      recordingSetting: "disabled",
      transcriptSetting: "save_transcript",
    });
    // not activated (draft)
    const { gateway } = fakeGateway();
    const started = await startSimulatedCall({ store, gateway }, { channel, from: "+1555" });
    expect(started.status).toBe("rejected");
    expect(started.reason).toBe("inactive");
  });

  it("does not make external calls, stores no raw audio, and keeps events metadata-only", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = new InMemoryStore();
    const channel = await seedActiveVoiceChannel(store);
    const { gateway } = fakeGateway();
    const started = await startSimulatedCall({ store, gateway }, { channel, from: "+15551234567" });
    const employee = (await store.getEmployee("org-1", channel.employeeId))!;
    await sendSimulatedUtterance(
      { store, gateway },
      { channel, employee, callSession: started.callSession!, text: "SECRET-CALLER-UTTERANCE-77" },
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    // Stream events + audit are metadata-only (no transcript content).
    const events = await store.listVoiceStreamEventsForCall("org-1", started.callSession!.id);
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain("SECRET-CALLER-UTTERANCE-77");
    expect(JSON.stringify(events)).not.toMatch(/audioRef|audio_file|\.wav|\.mp3/);
    const audits = store._auditEvents();
    expect(JSON.stringify(audits)).not.toContain("SECRET-CALLER-UTTERANCE-77");
    // The transcript content lives only in transcript storage.
    const transcript = await store.listVoiceTranscriptMessages("org-1", started.callSession!.id);
    expect(JSON.stringify(transcript)).toContain("SECRET-CALLER-UTTERANCE-77");
    fetchSpy.mockRestore();
  });

  it("does not store transcript when transcript is turned off", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", employee.id);
    const channel = await createVoiceChannel(store, actor, employee, {
      name: "Phone",
      provider: "simulated_voice",
      voiceStyle: "Professional",
      sttProvider: "simulated_stt",
      ttsProvider: "simulated_tts",
      recordingSetting: "disabled",
      transcriptSetting: "do_not_save",
    });
    await store.activateEmployeeChannel("org-1", channel.id);
    const active = (await store.getEmployeeChannel("org-1", channel.id))!;
    const { gateway } = fakeGateway();
    const started = await startSimulatedCall(
      { store, gateway },
      { channel: active, from: "+1555" },
    );
    await sendSimulatedUtterance(
      { store, gateway },
      {
        channel: active,
        employee,
        callSession: started.callSession!,
        text: "hi",
      },
    );
    const transcript = await store.listVoiceTranscriptMessages("org-1", started.callSession!.id);
    expect(transcript).toHaveLength(0);
  });
});

// --- Isolation + credentials ------------------------------------------------

describe("Voice isolation + credentials", () => {
  it("keeps channels and calls organization-scoped", async () => {
    const store = new InMemoryStore();
    const channel = await seedActiveVoiceChannel(store);
    expect(await store.getEmployeeChannel("org-1", channel.id)).toBeTruthy();
    expect(await store.getEmployeeChannel("org-2", channel.id)).toBeNull();

    const { gateway } = fakeGateway();
    const started = await startSimulatedCall({ store, gateway }, { channel, from: "+1555" });
    expect(await store.getVoiceCallSession("org-1", started.callSession!.id)).toBeTruthy();
    expect(await store.getVoiceCallSession("org-2", started.callSession!.id)).toBeNull();
  });

  it("refuses BYOK without encryption and never returns plaintext", async () => {
    const store = new InMemoryStore();
    delete process.env[MASTER_KEY_VAR];
    await expect(
      saveVoiceProviderCredential(
        store,
        actor,
        "twilio_voice",
        { accountSid: "AC", authToken: "t" },
        null,
      ),
    ).rejects.toThrow();

    process.env[MASTER_KEY_VAR] = "unit-test-voice-master-key-123";
    await saveVoiceProviderCredential(
      store,
      actor,
      "twilio_voice",
      { accountSid: "AC1", authToken: "voice-secret-token-4242" },
      "Prod",
    );
    const meta = await store.getChannelProviderCredentialMetadata("org-1", "twilio_voice");
    expect(meta?.keyLastFour).toBe("4242");
    expect(JSON.stringify(meta)).not.toContain("voice-secret-token-4242");
    const enc = await store.getChannelProviderEncryptedCredentials("org-1", "twilio_voice");
    expect(enc).not.toContain("voice-secret-token-4242");
  });
});

// --- Provider adapters + webhook --------------------------------------------

describe("Twilio voice adapter", () => {
  it("parses an inbound call and a call status", () => {
    const inbound = twilioVoiceProvider.parseInboundCallWebhook({
      method: "POST",
      url: "https://x",
      headers: {},
      query: {},
      rawBody: "",
      form: { CallSid: "CA1", From: "+15551112222", To: "+15550000000", CallStatus: "ringing" },
      json: null,
    });
    expect(inbound?.externalCallId).toBe("CA1");
    expect(inbound?.callerExternalId).toBe("+15551112222");

    const status = twilioVoiceProvider.parseCallStatusWebhook({
      method: "POST",
      url: "https://x",
      headers: {},
      query: {},
      rawBody: "",
      form: { CallSid: "CA1", CallStatus: "completed" },
      json: null,
    });
    expect(status?.status).toBe("completed");
  });
});

describe("Voice webhook processing", () => {
  it("resolves the channel by public key and answers an inbound call", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", employee.id);
    const channel = await createVoiceChannel(store, actor, employee, {
      name: "Phone",
      provider: "twilio_voice",
      phoneNumber: "+15550000000",
      voiceStyle: "Professional",
      sttProvider: "simulated_stt",
      ttsProvider: "simulated_tts",
      recordingSetting: "disabled",
      transcriptSetting: "save_transcript",
    });
    await store.activateEmployeeChannel("org-1", channel.id);
    const active = (await store.getEmployeeChannel("org-1", channel.id))!;
    const { gateway } = fakeGateway();

    const request: WebhookRequest = {
      method: "POST",
      url: `https://app/api/webhooks/voice/twilio/${active.publicKey}`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      query: {},
      rawBody: "",
      form: { CallSid: "CA9", From: "+15551234567", To: "+15550000000", CallStatus: "ringing" },
      json: null,
    };
    const result = await processVoiceWebhook(
      { store, gateway, isProduction: () => false },
      { providerSlug: "twilio", publicKey: active.publicKey, request },
    );
    expect(result.status).toBe(200);
    // Response is a provider payload; contains the spoken greeting, no secrets.
    expect(result.body).toContain("Nova");
    expect(result.body).not.toMatch(/authToken|accountSid|sk-/);
    const call = await store.getVoiceCallSessionByExternalId("twilio_voice", "CA9");
    expect(call).toBeTruthy();
    expect(call?.status).toBe("active");
  });

  it("returns 404 for an unknown public key", async () => {
    const store = new InMemoryStore();
    const { gateway } = fakeGateway();
    const request: WebhookRequest = {
      method: "POST",
      url: "https://app/api/webhooks/voice/twilio/tc_missing",
      headers: {},
      query: {},
      rawBody: "",
      form: { CallSid: "CA1", From: "+1", CallStatus: "ringing" },
      json: null,
    };
    const result = await processVoiceWebhook(
      { store, gateway, isProduction: () => false },
      { providerSlug: "twilio", publicKey: "tc_missing", request },
    );
    expect(result.status).toBe(404);
  });
});
