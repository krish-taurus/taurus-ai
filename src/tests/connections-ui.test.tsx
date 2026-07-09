import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ConnectionCard } from "@/components/connections/connection-card";
import { ConnectionCatalog } from "@/components/connections/connection-catalog";
import type { ChannelStatus, ChannelType, EmployeeChannel } from "@/lib/db/types";

function channel(overrides: Partial<EmployeeChannel> = {}): EmployeeChannel {
  return {
    id: "chan-1",
    organizationId: "org-1",
    employeeId: "emp-1",
    channelType: "website_widget" as ChannelType,
    channelProvider: "taurus_web",
    publicKey: "pk_test",
    hasSecret: false,
    name: "Website",
    status: "active" as ChannelStatus,
    allowedDomains: [],
    appearance: {
      theme: "dark",
      position: "bottom-right",
      launcherLabel: "Chat",
      employeeDisplayName: "Maya",
      accentStyle: "mono",
      showSources: true,
      collectVisitorEmail: false,
      brandName: null,
    },
    providerConfig: {},
    welcomeMessage: null,
    rateLimitPerMinute: 30,
    rateLimitPerDay: 1000,
    createdByUserId: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ConnectionCard (Sprint 014)", () => {
  it("shows status, AI Employee, provider, setup state, and Configure + Test for an active connection", () => {
    const { container } = render(
      <ConnectionCard channel={channel()} employeeName="Maya" canManage />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Website Widget");
    expect(text).toContain("Active");
    expect(text).toContain("Maya");
    expect(text).toContain("Taurus Web");
    expect(text).toContain("Connected"); // setup state
    expect(text).toContain("Configure");
    expect(text).toContain("Test");
  });

  it("hides Test for a draft connection and shows View for non-managers", () => {
    const { container } = render(
      <ConnectionCard
        channel={channel({ status: "draft" })}
        employeeName="Maya"
        canManage={false}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Draft");
    expect(text).toContain("View");
    expect(text).not.toContain("Test");
  });

  it("never renders secret-bearing fields", () => {
    const { container } = render(
      <ConnectionCard channel={channel()} employeeName="Maya" canManage />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("pk_test");
    expect(text.toLowerCase()).not.toContain("secret");
  });
});

describe("ConnectionCatalog (Sprint 014)", () => {
  it("renders all thirteen connection types with availability badges", () => {
    const { container } = render(<ConnectionCatalog canManage />);
    const text = container.textContent ?? "";
    for (const label of [
      "Website Widget",
      "Hosted Chat Link",
      "Iframe Embed",
      "Public API",
      "WhatsApp",
      "SMS",
      "Email",
      "Phone Calls",
      "Slack",
      "Microsoft Teams",
      "Instagram DM",
      "Facebook Messenger",
      "Telegram",
    ]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Available now");
    expect(text).toContain("Ready to set up");
    // Available channels say "Connect"; provider-needed ones say "Set up".
    expect(text).toContain("Connect");
    expect(text).toContain("Set up");
  });

  it("offers no setup action to non-managers", () => {
    const { container } = render(<ConnectionCatalog canManage={false} />);
    const links = [...container.querySelectorAll("a")].map((a) => a.textContent);
    expect(links).not.toContain("Connect");
    expect(links).not.toContain("Set up");
    expect(container.textContent).toContain("Ask an admin to configure this.");
  });
});
