/**
 * Web channel provider (Prompt 008) — server only.
 *
 * The only runnable provider this sprint. It turns a public inbound message into
 * a grounded reply by REUSING the Employee Chat Runtime (sendChatMessage), which
 * calls the Model Gateway only. It exposes just safe, public-facing fields — no
 * internal ids, storage paths, model keys, or hidden instructions.
 */

import type {
  ChannelInboundContext,
  ChannelProvider,
  ChannelRuntime,
  NormalizedOutboundMessage,
  PublicSourceRef,
} from "@/modules/channels/types";
import { sendChatMessage } from "@/modules/employee-chat/service";
import { getModel } from "@/modules/model-gateway/catalog";
import type { ChatSourceReference } from "@/lib/db/types";

function toPublicSources(sources: ChatSourceReference[]): PublicSourceRef[] {
  // Only name / type / preview cross the public boundary — never ids or paths.
  return sources.map((s) => ({ name: s.name, type: s.sourceType, preview: s.preview }));
}

export const webChannelProvider: ChannelProvider & ChannelRuntime = {
  providerType: "taurus_web",
  categories: ["web"],
  isAvailable() {
    return true;
  },

  async handleInbound(context: ChannelInboundContext): Promise<NormalizedOutboundMessage> {
    const { store, gateway, channel, employee, organizationName, session, message } = context;

    const result = await sendChatMessage(
      { store, gateway, isProduction: context.isProduction },
      {
        actor: { organizationId: channel.organizationId, userId: null, actorType: "system" },
        organizationName,
        employee,
        threadId: session.threadId,
        message,
      },
    );

    const showSources = channel.appearance.showSources;
    const modelDisplayName = result.assistantMessage.modelId
      ? (getModel(result.assistantMessage.modelId)?.displayName ?? null)
      : null;

    return {
      text: result.assistantMessage.content,
      sources: showSources ? toPublicSources(result.sources) : [],
      demo: result.demo,
      modelDisplayName,
      status: result.status,
    };
  },
};
