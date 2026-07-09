/**
 * Connections metadata + helpers (Sprint 014).
 *
 * "Connections" is the customer-facing name for deployment channels. This module
 * is a thin, pure presentation layer over the existing channel catalog + data —
 * it adds no providers and no runtime logic. It is safe to import from client
 * components (no server-only dependencies).
 *
 * Availability for the Connections UI is a three-way view over what is actually
 * built: web surfaces are available now; WhatsApp/SMS/Email/Phone Calls are
 * foundation (real setup pages exist, provider go-live pending); everything else
 * is clearly marked coming soon.
 */

import type {
  ChannelProviderType,
  ChannelStatus,
  ChannelType,
  EmployeeChannel,
} from "@/lib/db/types";
import { CHANNEL_DEFINITIONS_BY_TYPE } from "@/modules/channels/catalog";

export type ConnectionAvailability = "available" | "foundation" | "coming_soon";

/** The connection types shown on the Connections page, in display order. */
export const CONNECTION_TYPE_ORDER: ChannelType[] = [
  "website_widget",
  "hosted_chat",
  "iframe_embed",
  "public_api",
  "whatsapp",
  "sms",
  "email",
  "telegram",
  "facebook_messenger",
  "instagram_dm",
  "phone_call",
  "slack",
  "microsoft_teams",
];

const AVAILABILITY: Record<ChannelType, ConnectionAvailability> = {
  website_widget: "available",
  hosted_chat: "available",
  iframe_embed: "available",
  public_api: "available",
  // Telegram + Slack are live one-tap/one-token connects — genuinely available.
  telegram: "available",
  slack: "available",
  // These work end to end but need the owner's provider account to go live.
  whatsapp: "foundation",
  sms: "foundation",
  email: "foundation",
  phone_call: "foundation",
  instagram_dm: "foundation",
  facebook_messenger: "foundation",
  microsoft_teams: "foundation",
};

export const CONNECTION_AVAILABILITY_LABELS: Record<ConnectionAvailability, string> = {
  available: "Available now",
  foundation: "Ready to set up",
  coming_soon: "Coming soon",
};

/** Lifecycle status → customer-facing label. */
export const CONNECTION_STATUS_LABELS: Record<ChannelStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

/** Coarser "is it set up?" state, distinct from the lifecycle status. */
export const CONNECTION_SETUP_STATE_LABELS: Record<ChannelStatus, string> = {
  draft: "Setup in progress",
  active: "Connected",
  paused: "Connected · paused",
  archived: "Removed",
};

export const CONNECTION_PROVIDER_LABELS: Record<ChannelProviderType, string> = {
  taurus_web: "Taurus Web",
  twilio: "Twilio",
  meta_whatsapp_cloud: "Meta WhatsApp Cloud",
  telnyx: "Telnyx",
  vonage: "Vonage",
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
  slack: "Slack",
  microsoft_graph: "Microsoft Graph",
  telegram: "Telegram",
  meta_messenger: "Meta (Facebook Page)",
  meta_instagram: "Meta (Instagram)",
  custom_webhook: "Custom webhook",
  twilio_voice: "Twilio Voice",
  telnyx_voice: "Telnyx Voice",
  vonage_voice: "Vonage Voice",
  simulated_voice: "Simulated (test)",
};

export function connectionAvailability(type: ChannelType): ConnectionAvailability {
  return AVAILABILITY[type] ?? "coming_soon";
}

export function connectionTypeLabel(type: ChannelType): string {
  return CHANNEL_DEFINITIONS_BY_TYPE[type]?.label ?? type;
}

export function connectionTypeDescription(type: ChannelType): string {
  return CHANNEL_DEFINITIONS_BY_TYPE[type]?.description ?? "";
}

export function providerLabel(provider: ChannelProviderType): string {
  return CONNECTION_PROVIDER_LABELS[provider] ?? provider;
}

/** Connection types a user can actually configure today (available + foundation). */
export function isConfigurableType(type: ChannelType): boolean {
  return connectionAvailability(type) !== "coming_soon";
}

export const CONFIGURABLE_CONNECTION_TYPES: ChannelType[] =
  CONNECTION_TYPE_ORDER.filter(isConfigurableType);

/**
 * The existing per-employee setup page for a channel type — reused as-is so all
 * real configuration and testing continues to happen in the established admin UI.
 */
export function connectionSetupHref(employeeId: string, type: ChannelType): string {
  const base = `/dashboard/employees/${employeeId}/channels`;
  if (type === "phone_call") return `${base}/voice`;
  if (type === "slack") return `${base}/slack`;
  if (type === "microsoft_teams") return `${base}/teams`;
  if (
    type === "whatsapp" ||
    type === "sms" ||
    type === "email" ||
    type === "telegram" ||
    type === "facebook_messenger" ||
    type === "instagram_dm"
  )
    return `${base}/messaging/${type}`;
  // Web surfaces (and any fallback) are managed on the main channels page.
  return base;
}

/** Whether a test action is offered for a connection (only once it is active). */
export function connectionTestAvailable(status: ChannelStatus): boolean {
  return status === "active";
}

/**
 * A real "test this connection" target (distinct from Configure):
 *   - Web connections open their live hosted chat — a genuine end-to-end test.
 *   - Messaging/voice (foundation) open the setup page, where the "Simulate
 *     incoming message" / "Simulate call" panels exercise the runtime.
 */
export function connectionTestHref(
  publicKey: string,
  employeeId: string,
  type: ChannelType,
): string {
  if (connectionAvailability(type) === "available") {
    return `/public/chat/${publicKey}`;
  }
  return connectionSetupHref(employeeId, type);
}

/** Whether the test action opens a live external surface (new tab). */
export function connectionTestOpensLiveSurface(type: ChannelType): boolean {
  return connectionAvailability(type) === "available";
}

export interface ConnectionFilter {
  employeeId?: string | null;
  type?: ChannelType | null;
  status?: ChannelStatus | null;
}

/** Pure, organization-agnostic filtering used by the Connections overview. */
export function filterConnections(
  channels: EmployeeChannel[],
  filter: ConnectionFilter,
): EmployeeChannel[] {
  return channels.filter((c) => {
    if (filter.employeeId && c.employeeId !== filter.employeeId) return false;
    if (filter.type && c.channelType !== filter.type) return false;
    if (filter.status && c.status !== filter.status) return false;
    return true;
  });
}
