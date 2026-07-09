import { describe, it, expect } from "vitest";
import { buildReachLink } from "@/modules/channels/reach";
import type { ChannelType, EmployeeChannel } from "@/lib/db/types";

function channel(
  channelType: ChannelType,
  overrides: Partial<EmployeeChannel> = {},
): EmployeeChannel {
  return {
    id: "ch-1",
    organizationId: "org-1",
    employeeId: "emp-1",
    channelType,
    channelProvider: "taurus_web",
    publicKey: "tc_abc123",
    hasSecret: false,
    name: "Channel",
    status: "active",
    allowedDomains: [],
    appearance: {} as EmployeeChannel["appearance"],
    providerConfig: {},
    welcomeMessage: null,
    rateLimitPerMinute: 60,
    rateLimitPerDay: 1000,
    createdByUserId: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const APP = "https://app.taurus.ai";

describe("buildReachLink", () => {
  it("points web surfaces at the hosted chat page", () => {
    for (const t of ["website_widget", "hosted_chat", "iframe_embed", "public_api"] as ChannelType[]) {
      const link = buildReachLink(channel(t), APP);
      expect(link?.url).toBe("https://app.taurus.ai/public/chat/tc_abc123");
    }
    // Trailing slash on the app URL is normalized.
    expect(buildReachLink(channel("hosted_chat"), `${APP}/`)?.url).toBe(
      "https://app.taurus.ai/public/chat/tc_abc123",
    );
  });

  it("builds a t.me link for Telegram from the configured username (strips @)", () => {
    expect(
      buildReachLink(channel("telegram", { providerConfig: { senderId: "@AcmeSupportBot" } }), APP)
        ?.url,
    ).toBe("https://t.me/AcmeSupportBot");
    // No username configured → no reach link yet.
    expect(buildReachLink(channel("telegram", { providerConfig: {} }), APP)).toBeNull();
  });

  it("builds wa.me and sms links from a number, digits only", () => {
    expect(
      buildReachLink(channel("whatsapp", { providerConfig: { senderId: "+1 (555) 123-4567" } }), APP)
        ?.url,
    ).toBe("https://wa.me/15551234567");
    expect(
      buildReachLink(channel("sms", { providerConfig: { senderId: "+1-555-123-4567" } }), APP)?.url,
    ).toBe("sms:15551234567");
    expect(buildReachLink(channel("sms", { providerConfig: {} }), APP)).toBeNull();
  });

  it("returns null for channels without a public entry point", () => {
    expect(buildReachLink(channel("email", { providerConfig: { senderId: "x@y.com" } }), APP)).toBeNull();
  });
});
