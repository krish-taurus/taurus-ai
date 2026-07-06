/**
 * Placeholder channel providers (Prompt 008).
 *
 * Reserved foundation for messaging / voice / workplace channels. They implement
 * the ChannelProvider interface but report unavailable and refuse to run, so the
 * public API and dashboard can treat every channel uniformly today while a future
 * sprint adds each provider's real transport + authentication.
 */

import type { ChannelCategory, ChannelProviderType } from "@/lib/db/types";
import {
  ChannelNotAvailableError,
  type ChannelInboundContext,
  type ChannelProvider,
  type ChannelRuntime,
  type NormalizedOutboundMessage,
} from "@/modules/channels/types";

export function createPlaceholderProvider(
  providerType: ChannelProviderType,
  categories: ChannelCategory[],
): ChannelProvider & ChannelRuntime {
  return {
    providerType,
    categories,
    isAvailable() {
      return false;
    },
    async handleInbound(_context: ChannelInboundContext): Promise<NormalizedOutboundMessage> {
      void _context;
      throw new ChannelNotAvailableError(providerType);
    },
  };
}
