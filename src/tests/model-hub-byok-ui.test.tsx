import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// The React form-action hooks require the full server-action renderer, which
// jsdom lacks. Stub them so the panel renders with its initial state; the
// actions are only referenced, never invoked, in these render tests.
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormState: (_action: unknown, initial: unknown) => [initial, () => {}],
    useFormStatus: () => ({ pending: false }),
  };
});

import {
  ProviderCredentialsPanel,
  type ProviderCredentialView,
} from "@/components/model-hub/provider-credentials";

function view(overrides: Partial<ProviderCredentialView>): ProviderCredentialView {
  return {
    slug: "openai",
    displayName: "OpenAI",
    supportsByok: true,
    supportsPlatformKey: true,
    platformAvailable: false,
    documentationUrl: "https://platform.openai.com/docs",
    requiresBaseUrl: false,
    credentialMode: null,
    status: null,
    keyLastFour: null,
    baseUrl: null,
    label: null,
    ...overrides,
  };
}

describe("Provider credentials UI (Sprint 013)", () => {
  it("explains that keys are encrypted and never shown again, and shows the label field", () => {
    const { container, getByLabelText } = render(
      <ProviderCredentialsPanel items={[view({})]} encryptionConfigured canManage byokAvailable />,
    );
    expect(container.textContent).toContain("Your API key is encrypted and never shown again.");
    expect(getByLabelText(/Add your API key/)).toBeTruthy();
    expect(getByLabelText(/Label/)).toBeTruthy();
  });

  it("shows a base URL field only for a custom OpenAI-compatible provider", () => {
    const custom = render(
      <ProviderCredentialsPanel
        items={[
          view({
            slug: "custom_openai_compatible",
            displayName: "Custom (OpenAI-compatible)",
            requiresBaseUrl: true,
          }),
        ]}
        encryptionConfigured
        canManage
        byokAvailable
      />,
    );
    // Scope to each render's container so the two DOM trees never cross-match.
    expect(custom.container.querySelector('input[name="baseUrl"]')).toBeTruthy();

    const openai = render(
      <ProviderCredentialsPanel items={[view({})]} encryptionConfigured canManage byokAvailable />,
    );
    expect(openai.container.querySelector('input[name="baseUrl"]')).toBeNull();
  });

  it("masks a saved key, shows its status, and offers test + remove for an active BYOK key", () => {
    const { container } = render(
      <ProviderCredentialsPanel
        items={[
          view({
            credentialMode: "bring_your_own_key",
            status: "active",
            keyLastFour: "4242",
            label: "Finance",
          }),
        ]}
        encryptionConfigured
        canManage
        byokAvailable
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("•••• 4242");
    expect(text).toContain("Status: Active");
    expect(text).toContain("Test connection");
    expect(text).toContain("Remove key");
    // The full key is never present — only the last four.
    expect(text).not.toMatch(/sk-[A-Za-z0-9]{6,}/);
  });

  it("hides the setup form and explains when secure storage is not configured", () => {
    const { container } = render(
      <ProviderCredentialsPanel
        items={[view({})]}
        encryptionConfigured={false}
        canManage
        byokAvailable
      />,
    );
    expect(container.textContent).toContain("Secure key storage is not configured");
    expect(container.querySelector('input[name="apiKey"]')).toBeNull();
  });

  it("hides the setup form for non-managers", () => {
    const { container } = render(
      <ProviderCredentialsPanel
        items={[view({})]}
        encryptionConfigured
        canManage={false}
        byokAvailable
      />,
    );
    expect(container.textContent).toContain("Only owners and admins can manage provider keys.");
    expect(container.querySelector('input[name="apiKey"]')).toBeNull();
  });

  it("hides the setup form and shows an upgrade call-to-action when BYOK is not in the plan", () => {
    const { container, getByText } = render(
      <ProviderCredentialsPanel
        items={[view({})]}
        encryptionConfigured
        canManage
        byokAvailable={false}
      />,
    );
    expect(container.textContent).toContain(
      "Bringing your own model provider keys is available on the Growth and Scale plans.",
    );
    // No key entry — instead, a real link to upgrade.
    expect(container.querySelector('input[name="apiKey"]')).toBeNull();
    expect(getByText("Upgrade plan").closest("a")?.getAttribute("href")).toBe(
      "/dashboard/settings/billing/plans",
    );
  });
});
