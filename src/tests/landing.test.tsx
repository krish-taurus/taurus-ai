import { beforeAll, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Hero } from "@/components/landing/hero";
import { HeroWorkforceAnimation } from "@/components/landing/hero-workforce-animation";
import { AnimatedWorkflow } from "@/components/landing/animated-workflow";
import { EmployeeCardShowcase } from "@/components/landing/employee-card-showcase";
import { DnaPanel } from "@/components/landing/dna-panel";
import { KnowledgeVaultAnimation } from "@/components/landing/knowledge-vault-animation";
import { ModelHubAnimation } from "@/components/landing/model-hub-animation";
import { ChannelsAnimation } from "@/components/landing/channels-animation";
import { InboxAnimation } from "@/components/landing/inbox-animation";
import { TrustGrid } from "@/components/landing/trust-grid";
import { EcosystemSection } from "@/components/landing/ecosystem-section";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

/**
 * jsdom lacks the browser observers framer-motion's viewport features rely on.
 * Stub them so landing components can mount in tests.
 */
beforeAll(() => {
  class ObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(window, "IntersectionObserver", { writable: true, value: ObserverStub });
  Object.defineProperty(window, "ResizeObserver", { writable: true, value: ObserverStub });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe("Landing page components (Premium Landing v2)", () => {
  it("renders the navbar with brand, links, and the hire CTA", () => {
    const { getAllByText, getByLabelText } = render(<LandingNavbar />);
    expect(getByLabelText("Taurus AI home")).toBeTruthy();
    expect(getAllByText("Hire your first AI Employee").length).toBeGreaterThan(0);
  });

  it("renders the hero with the category headline and both CTAs", () => {
    const { getByText, container } = render(<Hero />);
    expect(container.textContent).toContain("The operating system for");
    expect(container.textContent).toContain("AI Employees.");
    expect(getByText("Hire your first AI Employee").closest("a")?.getAttribute("href")).toBe(
      "/signup",
    );
    expect(getByText("Watch how Taurus works").closest("a")?.getAttribute("href")).toBe(
      "#how-it-works",
    );
  });

  it("renders the workforce network with company, Employees, governance, and channels", () => {
    const { container } = render(<HeroWorkforceAnimation />);
    for (const label of [
      "Your Company",
      "Employee DNA",
      "Knowledge Vault",
      "Model Hub",
      "Website",
      "WhatsApp",
      "Email",
      "Voice-ready",
      "Inbox",
    ]) {
      expect(container.textContent).toContain(label);
    }
  });

  it("renders all six walkthrough steps as accessible buttons", () => {
    const { getAllByRole, container } = render(<AnimatedWorkflow />);
    expect(container.textContent).toContain("From idea to deployed AI Employee in minutes.");
    const stepButtons = getAllByRole("button");
    expect(stepButtons.length).toBe(6);
  });

  it("renders eight AI Employee role cards", () => {
    const { container } = render(<EmployeeCardShowcase />);
    for (const role of [
      "AI Receptionist",
      "AI Sales Assistant",
      "AI Customer Support Employee",
      "AI HR Assistant",
      "AI Operations Assistant",
      "AI Finance Assistant",
      "AI Legal Intake Assistant",
      "AI Internal Knowledge Assistant",
    ]) {
      expect(container.textContent).toContain(role);
    }
  });

  it("renders the DNA panel with the allowed marketing hook and all sections", () => {
    const { container } = render(<DnaPanel />);
    expect(container.textContent).toContain("Replace prompt engineering with Employee DNA.");
    for (const section of [
      "Mission",
      "Responsibilities",
      "Communication Style",
      "Boundaries",
      "Escalation Rules",
    ]) {
      expect(container.textContent).toContain(section);
    }
  });

  it("renders Knowledge Vault, Model Hub, Channels, and Inbox showcases", () => {
    expect(render(<KnowledgeVaultAnimation />).container.textContent).toContain("Knowledge Vault");
    const hub = render(<ModelHubAnimation />).container.textContent;
    expect(hub).toContain("Choose the right brain for every job.");
    expect(hub).toContain("Privacy First");
    const channels = render(<ChannelsAnimation />).container.textContent;
    expect(channels).toContain(
      "One Employee. Many channels. Same DNA, same knowledge, same governance.",
    );
    expect(render(<InboxAnimation />).container.textContent).toContain(
      "Every conversation. One command center.",
    );
  });

  it("renders trust and future-ecosystem sections with careful positioning", () => {
    const trust = render(<TrustGrid />).container.textContent;
    expect(trust).toContain("Governance from day one.");
    expect(trust).toContain("designed for enterprise governance");
    const ecosystem = render(<EcosystemSection />).container.textContent;
    expect(ecosystem).toContain("building toward");
  });

  it("routes the final CTAs to existing auth pages", () => {
    const { getByText } = render(<FinalCta />);
    expect(getByText("Get started").closest("a")?.getAttribute("href")).toBe("/signup");
    expect(getByText("Sign in").closest("a")?.getAttribute("href")).toBe("/login");
  });

  it("renders the footer with brand and navigation columns", () => {
    const { container } = render(<LandingFooter />);
    for (const label of ["Product", "Platform", "Resources", "Company", "All rights reserved."]) {
      expect(container.textContent).toContain(label);
    }
  });
});
