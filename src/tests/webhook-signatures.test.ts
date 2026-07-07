import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  sha256Hex,
  verifyEcdsaP256,
  verifyEd25519,
  verifyJwtHs256,
} from "@/modules/channels/messaging/signature-verify";
import { telnyxVoiceProvider } from "@/modules/voice-runtime/providers/telnyx-voice";
import { vonageVoiceProvider } from "@/modules/voice-runtime/providers/vonage-voice";
import { sendgridProvider } from "@/modules/channels/messaging/providers/sendgrid-email";
import type { VoiceProviderConfig } from "@/modules/voice-runtime/types";
import type { MessagingProviderConfig, WebhookRequest } from "@/modules/channels/messaging/types";

/**
 * Batch 6 — real webhook signature verification for the foundation providers
 * (Telnyx Ed25519, Vonage signed-webhook JWT, SendGrid ECDSA event webhook).
 * These generate real key material and signatures with node:crypto and assert
 * valid signatures verify while tampered / missing ones fail-closed.
 */

function voiceConfig(secrets: Record<string, string>): VoiceProviderConfig {
  return { mode: "live", secrets, channelConfig: {} };
}
function messagingConfig(secrets: Record<string, string>): MessagingProviderConfig {
  return { mode: "live", secrets, channelConfig: {} };
}
function req(overrides: Partial<WebhookRequest>): WebhookRequest {
  return {
    method: "POST",
    url: "https://taurus.example/api/webhooks/voice/telnyx/pk",
    headers: {},
    query: {},
    rawBody: "",
    form: {},
    json: null,
    ...overrides,
  };
}

// --- Ed25519 (Telnyx) -------------------------------------------------------

function ed25519Keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const rawPublic = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return { rawPublicB64: rawPublic.toString("base64"), privateKey };
}

describe("verifyEd25519", () => {
  it("accepts a valid signature and rejects tampering / bad keys", () => {
    const { rawPublicB64, privateKey } = ed25519Keypair();
    const message = '1700000000|{"event":"call.initiated"}';
    const sig = crypto.sign(null, Buffer.from(message), privateKey).toString("base64");

    expect(verifyEd25519(rawPublicB64, message, sig)).toBe(true);
    expect(verifyEd25519(rawPublicB64, message + "x", sig)).toBe(false);
    expect(verifyEd25519(ed25519Keypair().rawPublicB64, message, sig)).toBe(false);
    expect(verifyEd25519("not-a-key", message, sig)).toBe(false);
    expect(verifyEd25519(rawPublicB64, message, "not-a-sig")).toBe(false);
  });
});

describe("Telnyx voice verifyWebhook (Ed25519, fail-closed)", () => {
  it("verifies a correctly signed request", async () => {
    const { rawPublicB64, privateKey } = ed25519Keypair();
    const rawBody = JSON.stringify({ data: { event_type: "call.initiated" } });
    const timestamp = "1700000000";
    const signature = crypto
      .sign(null, Buffer.from(`${timestamp}|${rawBody}`), privateKey)
      .toString("base64");

    const result = await telnyxVoiceProvider.verifyWebhook(
      req({
        rawBody,
        headers: { "telnyx-signature-ed25519": signature, "telnyx-timestamp": timestamp },
      }),
      voiceConfig({ publicKey: rawPublicB64 }),
    );
    expect(result.verified).toBe(true);
  });

  it("rejects a tampered body, missing headers, and unconfigured keys", async () => {
    const { rawPublicB64, privateKey } = ed25519Keypair();
    const timestamp = "1700000000";
    const signature = crypto
      .sign(null, Buffer.from(`${timestamp}|original`), privateKey)
      .toString("base64");

    const tampered = await telnyxVoiceProvider.verifyWebhook(
      req({
        rawBody: "tampered",
        headers: { "telnyx-signature-ed25519": signature, "telnyx-timestamp": timestamp },
      }),
      voiceConfig({ publicKey: rawPublicB64 }),
    );
    expect(tampered.verified).toBe(false);

    const missing = await telnyxVoiceProvider.verifyWebhook(
      req({ rawBody: "x" }),
      voiceConfig({ publicKey: rawPublicB64 }),
    );
    expect(missing).toEqual({ verified: false, reason: "missing_signature" });

    const unconfigured = await telnyxVoiceProvider.verifyWebhook(req({}), voiceConfig({}));
    expect(unconfigured).toEqual({ verified: false, reason: "not_configured" });
  });
});

// --- Vonage signed webhook (JWT HS256) --------------------------------------

function makeJwt(secret: string, payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

describe("verifyJwtHs256", () => {
  it("accepts a valid token, rejects tampering and wrong alg", () => {
    const token = makeJwt("s3cr3t", { api_key: "abc" });
    expect(verifyJwtHs256(token, "s3cr3t").valid).toBe(true);
    expect(verifyJwtHs256(token, "wrong").valid).toBe(false);
    expect(verifyJwtHs256(token + "x", "s3cr3t").valid).toBe(false);
    expect(verifyJwtHs256("a.b.c", "s3cr3t").valid).toBe(false);
  });
});

describe("Vonage voice verifyWebhook (signed webhook, fail-closed)", () => {
  it("verifies a valid Bearer JWT whose payload_hash matches the body", async () => {
    const secret = "signature-secret";
    const rawBody = JSON.stringify({ uuid: "abc", from: "15551230000" });
    const token = makeJwt(secret, { payload_hash: sha256Hex(rawBody) });

    const result = await vonageVoiceProvider.verifyWebhook(
      req({ rawBody, headers: { authorization: `Bearer ${token}` } }),
      voiceConfig({ apiSecret: secret }),
    );
    expect(result.verified).toBe(true);
  });

  it("rejects a mismatched payload_hash, bad secret, and missing header", async () => {
    const secret = "signature-secret";
    const rawBody = JSON.stringify({ uuid: "abc" });
    const mismatch = makeJwt(secret, { payload_hash: sha256Hex("something-else") });
    const mismatchRes = await vonageVoiceProvider.verifyWebhook(
      req({ rawBody, headers: { authorization: `Bearer ${mismatch}` } }),
      voiceConfig({ apiSecret: secret }),
    );
    expect(mismatchRes).toEqual({ verified: false, reason: "payload_mismatch" });

    const forged = makeJwt("attacker-secret", { payload_hash: sha256Hex(rawBody) });
    const forgedRes = await vonageVoiceProvider.verifyWebhook(
      req({ rawBody, headers: { authorization: `Bearer ${forged}` } }),
      voiceConfig({ apiSecret: secret }),
    );
    expect(forgedRes).toEqual({ verified: false, reason: "invalid_signature" });

    const noHeader = await vonageVoiceProvider.verifyWebhook(
      req({ rawBody }),
      voiceConfig({ apiSecret: secret }),
    );
    expect(noHeader).toEqual({ verified: false, reason: "missing_signature" });

    const unconfigured = await vonageVoiceProvider.verifyWebhook(req({}), voiceConfig({}));
    expect(unconfigured).toEqual({ verified: false, reason: "not_configured" });
  });
});

// --- SendGrid ECDSA event webhook -------------------------------------------

function ecdsaKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  return {
    spkiB64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    privateKey,
  };
}

function ecdsaSign(privateKey: crypto.KeyObject, message: string): string {
  const signer = crypto.createSign("SHA256");
  signer.update(message);
  signer.end();
  return signer.sign(privateKey).toString("base64");
}

describe("verifyEcdsaP256", () => {
  it("accepts a valid signature and rejects tampering", () => {
    const { spkiB64, privateKey } = ecdsaKeypair();
    const message = '1700000000[{"event":"delivered"}]';
    const sig = ecdsaSign(privateKey, message);
    expect(verifyEcdsaP256(spkiB64, message, sig)).toBe(true);
    expect(verifyEcdsaP256(spkiB64, message + "x", sig)).toBe(false);
    expect(verifyEcdsaP256(ecdsaKeypair().spkiB64, message, sig)).toBe(false);
  });
});

describe("SendGrid verifyWebhook (ECDSA event webhook + unsigned inbound)", () => {
  it("verifies a correctly signed event webhook", async () => {
    const { spkiB64, privateKey } = ecdsaKeypair();
    const rawBody = JSON.stringify([{ event: "delivered" }]);
    const timestamp = "1700000000";
    const signature = ecdsaSign(privateKey, `${timestamp}${rawBody}`);

    const result = await sendgridProvider.verifyWebhook(
      req({
        rawBody,
        headers: {
          "x-twilio-email-event-webhook-signature": signature,
          "x-twilio-email-event-webhook-timestamp": timestamp,
        },
      }),
      messagingConfig({ apiKey: "SG.x", verificationKey: spkiB64 }),
    );
    expect(result.verified).toBe(true);
  });

  it("rejects a tampered event webhook and one with no verification key", async () => {
    const { spkiB64, privateKey } = ecdsaKeypair();
    const timestamp = "1700000000";
    const signature = ecdsaSign(privateKey, `${timestamp}original`);

    const tampered = await sendgridProvider.verifyWebhook(
      req({
        rawBody: "tampered",
        headers: {
          "x-twilio-email-event-webhook-signature": signature,
          "x-twilio-email-event-webhook-timestamp": timestamp,
        },
      }),
      messagingConfig({ apiKey: "SG.x", verificationKey: spkiB64 }),
    );
    expect(tampered.verified).toBe(false);

    const noKey = await sendgridProvider.verifyWebhook(
      req({
        rawBody: "{}",
        headers: {
          "x-twilio-email-event-webhook-signature": signature,
          "x-twilio-email-event-webhook-timestamp": timestamp,
        },
      }),
      messagingConfig({ apiKey: "SG.x" }),
    );
    expect(noKey).toEqual({ verified: false, reason: "not_configured" });
  });

  it("treats unsigned Inbound Parse as secret-URL authenticated (no signature to check)", async () => {
    const inbound = await sendgridProvider.verifyWebhook(
      req({ form: { from: "a@b.com", text: "hi" } }),
      messagingConfig({ apiKey: "SG.x" }),
    );
    expect(inbound).toEqual({ verified: true, reason: "unsigned_inbound_parse" });

    const unconfigured = await sendgridProvider.verifyWebhook(req({}), messagingConfig({}));
    expect(unconfigured).toEqual({ verified: false, reason: "not_configured" });
  });
});
