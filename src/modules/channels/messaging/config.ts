/**
 * Provider config resolution (Prompt 009) — server only.
 *
 * Builds the secrets + non-secret config a provider adapter needs. Secrets come
 * from an organization's encrypted BYOK credential (decrypted here, server-only)
 * or from platform env vars, and are NEVER returned to the client. When no
 * secrets resolve, the provider runs in simulated mode.
 */

import type { ChannelProviderType, EmployeeChannel } from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import type {
  MessagingProvider,
  MessagingProviderConfig,
} from "@/modules/channels/messaging/types";
import { decryptCredentials, isChannelEncryptionConfigured } from "@/modules/channels/credentials";

function envSecretsFor(providerType: ChannelProviderType): Record<string, string> {
  const s: Record<string, string> = {};
  const set = (k: string, v: string | undefined) => {
    if (v && v.trim()) s[k] = v;
  };
  switch (providerType) {
    case "twilio":
      set("accountSid", process.env.TWILIO_ACCOUNT_SID);
      set("authToken", process.env.TWILIO_AUTH_TOKEN);
      set("messagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
      break;
    case "meta_whatsapp_cloud":
      set("accessToken", process.env.META_WHATSAPP_ACCESS_TOKEN);
      set("phoneNumberId", process.env.META_WHATSAPP_PHONE_NUMBER_ID);
      set("verifyToken", process.env.META_WHATSAPP_VERIFY_TOKEN);
      break;
    case "sendgrid":
      set("apiKey", process.env.SENDGRID_API_KEY);
      break;
    case "mailgun":
      set("apiKey", process.env.MAILGUN_API_KEY);
      set("domain", process.env.MAILGUN_DOMAIN);
      break;
    case "telegram":
      set("botToken", process.env.TELEGRAM_BOT_TOKEN);
      set("webhookSecret", process.env.TELEGRAM_WEBHOOK_SECRET);
      break;
    case "slack":
      // App-level signing secret (the per-workspace bot token comes from OAuth,
      // stored as an encrypted BYOK credential).
      set("signingSecret", process.env.SLACK_SIGNING_SECRET);
      break;
    case "meta_messenger":
    case "meta_instagram":
      // App-level secret + verify token (the per-Page access token is BYOK).
      set("appSecret", process.env.META_APP_SECRET ?? process.env.WHATSAPP_APP_SECRET);
      set("verifyToken", process.env.META_WEBHOOK_VERIFY_TOKEN);
      break;
    default:
      break;
  }
  return s;
}

/**
 * Resolve the full provider config for a channel. Prefers an org BYOK credential
 * (decrypted) and falls back to platform env secrets.
 */
export async function resolveProviderConfig(
  store: DataStore,
  channel: EmployeeChannel,
  provider: MessagingProvider,
): Promise<MessagingProviderConfig> {
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

  // Fall back to platform env secrets for any keys not provided by BYOK.
  if (Object.keys(secrets).length === 0) {
    secrets = envSecretsFor(channel.channelProvider);
  }

  const channelConfig = channel.providerConfig ?? {};
  const base: MessagingProviderConfig = { mode: "simulated", secrets, channelConfig };
  return { ...base, mode: provider.getProviderStatus(base).mode };
}
