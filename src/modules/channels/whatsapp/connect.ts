/**
 * WhatsApp Embedded Signup connect (Sprint 041) — server only.
 *
 * "Connect WhatsApp" is Meta's Embedded Signup: the owner picks/registers a
 * number in a hosted popup (no tokens to paste). The popup returns a short-lived
 * `code` + the chosen `phone_number_id`; this module exchanges the code for a
 * business access token and persists it (encrypted) so the existing
 * meta_whatsapp_cloud adapter can send + verify.
 *
 * Going fully live requires a Meta Tech Provider app + business verification.
 * Without the app configured, the connect UI is hidden and WhatsApp still works
 * via manual credential entry.
 */

import type { AiEmployee, EmployeeChannel } from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import { generatePublicKey } from "@/modules/channels/keys";
import { defaultAppearance } from "@/modules/channels/appearance";
import { saveProviderCredential, type MessagingActor } from "@/modules/channels/messaging/service";

const GRAPH_VERSION = "v20.0";

export class WhatsAppConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppConnectError";
  }
}

export function whatsappAppId(): string | null {
  return process.env.NEXT_PUBLIC_WHATSAPP_APP_ID?.trim() || null;
}
export function whatsappConfigId(): string | null {
  return process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID?.trim() || null;
}
function appSecret(): string | null {
  return process.env.WHATSAPP_APP_SECRET?.trim() || null;
}

/** True when Embedded Signup can run (client ids + server secret all present). */
export function isWhatsAppEmbeddedSignupConfigured(): boolean {
  return !!(whatsappAppId() && whatsappConfigId() && appSecret());
}

async function graphGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new WhatsAppConnectError(err?.message ?? `Meta error ${res.status}`);
  }
  return json;
}

/** Exchange the Embedded Signup `code` for a business access token. */
export async function exchangeCode(code: string): Promise<string> {
  const clientId = whatsappAppId();
  const secret = appSecret();
  if (!clientId || !secret) throw new WhatsAppConnectError("WhatsApp is not configured on this server.");
  const params = new URLSearchParams({ client_id: clientId, client_secret: secret, code });
  const data = await graphGet(`oauth/access_token?${params.toString()}`);
  const token = typeof data.access_token === "string" ? data.access_token : null;
  if (!token) throw new WhatsAppConnectError("WhatsApp sign-in could not be completed.");
  return token;
}

export interface WhatsAppNumber {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
}

/** Look up a phone number's display details (best-effort; safe defaults). */
export async function getPhoneNumber(
  accessToken: string,
  phoneNumberId: string,
): Promise<WhatsAppNumber> {
  try {
    const data = await graphGet(
      `${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(accessToken)}`,
    );
    return {
      phoneNumberId,
      displayPhoneNumber: typeof data.display_phone_number === "string" ? data.display_phone_number : null,
      verifiedName: typeof data.verified_name === "string" ? data.verified_name : null,
    };
  } catch {
    return { phoneNumberId, displayPhoneNumber: null, verifiedName: null };
  }
}

/**
 * Persist a completed WhatsApp connect: store the access token + phone number id
 * + app secret (encrypted) and create/refresh the employee's active WhatsApp
 * connection. Reuses the existing meta_whatsapp_cloud adapter for send + verify.
 */
export async function connectWhatsApp(
  store: DataStore,
  actor: MessagingActor,
  input: { employee: AiEmployee; token: string; number: WhatsAppNumber },
): Promise<EmployeeChannel> {
  const { employee, token, number } = input;
  const secret = appSecret();

  await saveProviderCredential(
    store,
    actor,
    "meta_whatsapp_cloud",
    {
      accessToken: token,
      phoneNumberId: number.phoneNumberId,
      ...(secret ? { appSecret: secret } : {}),
    },
    number.verifiedName ?? number.displayPhoneNumber ?? "WhatsApp",
  );

  const senderId = number.displayPhoneNumber ?? number.phoneNumberId;
  const providerConfig = { senderId, phoneNumberId: number.phoneNumberId };

  const existing = (
    await store.listEmployeeChannelsForEmployee(actor.organizationId, employee.id)
  ).find((c) => c.channelType === "whatsapp" && c.status !== "archived");

  if (existing) {
    await store.updateEmployeeChannel(actor.organizationId, existing.id, { providerConfig });
    await store.activateEmployeeChannel(actor.organizationId, existing.id);
    return (await store.getEmployeeChannel(actor.organizationId, existing.id)) ?? existing;
  }

  const channel = await store.createEmployeeChannel({
    organizationId: actor.organizationId,
    employeeId: employee.id,
    channelType: "whatsapp",
    channelProvider: "meta_whatsapp_cloud",
    publicKey: generatePublicKey(),
    name: number.verifiedName ? `WhatsApp · ${number.verifiedName}` : "WhatsApp",
    status: "draft",
    allowedDomains: [],
    appearance: { ...defaultAppearance(employee), employeeDisplayName: employee.name },
    providerConfig,
    welcomeMessage: null,
    createdByUserId: actor.userId,
  });
  await store.activateEmployeeChannel(actor.organizationId, channel.id);
  return (await store.getEmployeeChannel(actor.organizationId, channel.id)) ?? channel;
}
