/**
 * Channel abstraction types (Prompt 008).
 *
 * Normalized message/session/event shapes shared across every channel, plus the
 * ChannelProvider + ChannelRuntime interfaces. Web is implemented; messaging /
 * voice / workplace providers are placeholders that report unavailable. Product
 * code depends on these interfaces, never on a specific provider SDK.
 */

import type {
  AiEmployee,
  ChannelCategory,
  ChannelProviderType,
  ChannelType,
  EmployeeChannel,
  KnowledgeSourceType,
  PublicChatSession,
} from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import type { ChatGateway } from "@/modules/employee-chat/service";

/** A safe, public-facing source reference (no internal ids or storage paths). */
export interface PublicSourceRef {
  name: string;
  type: KnowledgeSourceType;
  preview: string;
}

/** A message coming INTO Taurus from a channel (already normalized). */
export interface NormalizedInboundMessage {
  channelType: ChannelType;
  publicKey: string;
  sessionId: string | null;
  visitorId: string;
  text: string;
  originDomain: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
}

/** A message going OUT to a channel (already normalized). */
export interface NormalizedOutboundMessage {
  text: string;
  sources: PublicSourceRef[];
  demo: boolean;
  modelDisplayName: string | null;
  status: "sent" | "failed";
}

/** A normalized channel session (maps a visitor to an isolated conversation). */
export interface NormalizedChannelSession {
  sessionId: string;
  visitorId: string;
  channelId: string;
  status: PublicChatSession["status"];
}

/** A normalized delivery/lifecycle event (metadata only). */
export interface NormalizedDeliveryEvent {
  type: "generated" | "failed" | "session_started";
  status: "sent" | "failed" | "active";
  metadata: Record<string, string | number | boolean | null>;
}

/** Context handed to a provider to produce a reply for one inbound message. */
export interface ChannelInboundContext {
  store: DataStore;
  gateway: ChatGateway;
  channel: EmployeeChannel;
  employee: AiEmployee;
  organizationName: string;
  session: PublicChatSession;
  message: string;
  isProduction?: () => boolean;
}

/**
 * A channel provider. Web is available; others report unavailable until a future
 * sprint implements their transport + authentication.
 */
export interface ChannelProvider {
  providerType: ChannelProviderType;
  categories: ChannelCategory[];
  isAvailable(): boolean;
}

/** A runtime that can turn an inbound message into an outbound reply. */
export interface ChannelRuntime {
  handleInbound(context: ChannelInboundContext): Promise<NormalizedOutboundMessage>;
}

/** Raised when a channel/provider is not runnable (kept generic for public API). */
export class ChannelNotAvailableError extends Error {
  constructor(readonly providerType: ChannelProviderType) {
    super(`Channel provider ${providerType} is not available yet.`);
    this.name = "ChannelNotAvailableError";
  }
}
