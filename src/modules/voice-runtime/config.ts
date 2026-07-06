/**
 * Voice provider config resolution (Prompt 010) — server only.
 *
 * Builds the secrets + non-secret config a voice provider needs. Secrets come
 * from an organization's encrypted BYOK credential (decrypted here, server-only)
 * or platform env vars, and are NEVER returned to the client. When no secrets
 * resolve, the provider runs in simulated mode.
 */

import type { ChannelProviderType, EmployeeChannel } from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import type { VoiceProvider, VoiceProviderConfig } from "@/modules/voice-runtime/types";
import { decryptCredentials, isChannelEncryptionConfigured } from "@/modules/channels/credentials";

function envSecretsFor(providerType: ChannelProviderType): Record<string, string> {
  const s: Record<string, string> = {};
  const set = (k: string, v: string | undefined) => {
    if (v && v.trim()) s[k] = v;
  };
  switch (providerType) {
    case "twilio_voice":
      set("accountSid", process.env.TWILIO_ACCOUNT_SID);
      set("authToken", process.env.TWILIO_AUTH_TOKEN);
      break;
    case "telnyx_voice":
      set("apiKey", process.env.TELNYX_API_KEY);
      set("publicKey", process.env.TELNYX_PUBLIC_KEY);
      break;
    case "vonage_voice":
      set("apiKey", process.env.VONAGE_API_KEY);
      set("apiSecret", process.env.VONAGE_API_SECRET);
      break;
    default:
      break;
  }
  return s;
}

export async function resolveVoiceProviderConfig(
  store: DataStore,
  channel: EmployeeChannel,
  provider: VoiceProvider,
): Promise<VoiceProviderConfig> {
  let secrets: Record<string, string> = {};

  const meta = await store.getChannelProviderCredentialMetadata(
    channel.organizationId,
    channel.channelProvider,
  );
  if (
    meta &&
    meta.credentialMode === "bring_your_own_key" &&
    meta.status === "active" &&
    isChannelEncryptionConfigured()
  ) {
    const encrypted = await store.getChannelProviderEncryptedCredentials(
      channel.organizationId,
      channel.channelProvider,
    );
    if (encrypted) {
      try {
        secrets = JSON.parse(await decryptCredentials(encrypted)) as Record<string, string>;
      } catch {
        secrets = {};
      }
    }
  }

  if (Object.keys(secrets).length === 0) {
    secrets = envSecretsFor(channel.channelProvider);
  }

  const base: VoiceProviderConfig = {
    mode: "simulated",
    secrets,
    channelConfig: channel.providerConfig ?? {},
  };
  return { ...base, mode: provider.getProviderStatus(base).mode };
}
