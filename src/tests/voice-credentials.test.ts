import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { hasPermission } from "@/modules/organizations/roles";
import {
  disableVoiceProviderCredential,
  saveVoiceProviderCredential,
} from "@/modules/voice-runtime/service";
import {
  disableVoiceCredentialSchema,
  saveVoiceCredentialSchema,
} from "@/modules/voice-runtime/schema";

/**
 * Batch 5 — voice credential parity with messaging: Zod validation on save,
 * plus a Disable path (action + service) that mirrors the messaging credential
 * flow. Encryption is enabled by setting the channel master key (as the
 * messaging tests do).
 */
const MASTER_KEY_VAR = "TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY";
const actor = { organizationId: "org-1", userId: "user-1" };

beforeEach(() => {
  process.env[MASTER_KEY_VAR] = "unit-test-channel-master-key-123";
});
afterEach(() => {
  delete process.env[MASTER_KEY_VAR];
});

describe("saveVoiceCredentialSchema (Zod)", () => {
  it("accepts a known credentialed provider and an optional label", () => {
    expect(saveVoiceCredentialSchema.safeParse({ providerType: "twilio_voice" }).success).toBe(
      true,
    );
    expect(
      saveVoiceCredentialSchema.safeParse({ providerType: "vonage_voice", label: "Prod" }).success,
    ).toBe(true);
  });

  it("rejects an unknown / non-credentialed provider", () => {
    expect(saveVoiceCredentialSchema.safeParse({ providerType: "simulated_voice" }).success).toBe(
      false,
    );
    expect(saveVoiceCredentialSchema.safeParse({ providerType: "nonsense" }).success).toBe(false);
  });

  it("rejects an over-long label", () => {
    expect(
      saveVoiceCredentialSchema.safeParse({ providerType: "twilio_voice", label: "x".repeat(81) })
        .success,
    ).toBe(false);
  });

  it("disable schema also requires a known credentialed provider", () => {
    expect(disableVoiceCredentialSchema.safeParse({ providerType: "telnyx_voice" }).success).toBe(
      true,
    );
    expect(
      disableVoiceCredentialSchema.safeParse({ providerType: "simulated_voice" }).success,
    ).toBe(false);
  });
});

describe("saveVoiceProviderCredential (service)", () => {
  it("encrypts and stores a credential, keeping only the last four", async () => {
    const store = new InMemoryStore();
    await saveVoiceProviderCredential(
      store,
      actor,
      "twilio_voice",
      { accountSid: "AC123", authToken: "supersecrettoken9999" },
      "Prod",
    );

    const meta = await store.getChannelProviderCredentialMetadata("org-1", "twilio_voice");
    expect(meta?.status).toBe("active");
    expect(meta?.credentialMode).toBe("bring_your_own_key");
    expect(meta?.keyLastFour).toBe("9999");
    // Metadata must never carry the raw or encrypted secret.
    expect(JSON.stringify(meta)).not.toContain("supersecrettoken");

    // Encrypted blob is server-only and never equals plaintext.
    const blob = await store.getChannelProviderEncryptedCredentials("org-1", "twilio_voice");
    expect(blob).toBeTruthy();
    expect(blob).not.toContain("supersecrettoken");
  });

  it("throws when a required secret field is missing", async () => {
    const store = new InMemoryStore();
    await expect(
      saveVoiceProviderCredential(store, actor, "twilio_voice", { accountSid: "AC" }, null),
    ).rejects.toThrow(/required credential/i);
  });

  it("throws when secure storage is not configured", async () => {
    delete process.env[MASTER_KEY_VAR];
    const store = new InMemoryStore();
    await expect(
      saveVoiceProviderCredential(
        store,
        actor,
        "twilio_voice",
        { accountSid: "AC", authToken: "tok" },
        null,
      ),
    ).rejects.toThrow(/not configured/i);
  });
});

describe("disableVoiceProviderCredential (service)", () => {
  it("disables a saved credential and records an audit event", async () => {
    const store = new InMemoryStore();
    await saveVoiceProviderCredential(
      store,
      actor,
      "vonage_voice",
      { apiKey: "key", apiSecret: "shhh-secret-1234" },
      null,
    );
    expect(
      (await store.getChannelProviderCredentialMetadata("org-1", "vonage_voice"))?.status,
    ).toBe("active");

    await disableVoiceProviderCredential(store, actor, "vonage_voice");

    const meta = await store.getChannelProviderCredentialMetadata("org-1", "vonage_voice");
    expect(meta?.status).toBe("disabled");
    expect(meta?.keyLastFour).toBeNull();
    expect(await store.getChannelProviderEncryptedCredentials("org-1", "vonage_voice")).toBeNull();

    const audit = store._auditEvents().map((e) => e.action);
    expect(audit).toContain("channel_provider_credential.disabled");
  });

  it("does not touch another organization's credential", async () => {
    const store = new InMemoryStore();
    await saveVoiceProviderCredential(
      store,
      { organizationId: "org-2", userId: "u2" },
      "twilio_voice",
      { accountSid: "AC", authToken: "tok-2222" },
      null,
    );
    // Disabling for org-1 (which has none) must not affect org-2.
    await disableVoiceProviderCredential(store, actor, "twilio_voice");
    expect(
      (await store.getChannelProviderCredentialMetadata("org-2", "twilio_voice"))?.status,
    ).toBe("active");
  });
});

describe("Voice credential permission boundary", () => {
  it("managing voice credentials is owner/admin only (messaging_channel.manage)", () => {
    expect(hasPermission("owner", "messaging_channel.manage")).toBe(true);
    expect(hasPermission("admin", "messaging_channel.manage")).toBe(true);
    expect(hasPermission("builder", "messaging_channel.manage")).toBe(false);
    expect(hasPermission("viewer", "messaging_channel.manage")).toBe(false);
  });
});
