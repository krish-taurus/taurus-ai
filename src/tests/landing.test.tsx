import { beforeAll, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LandingNavbarLight } from "@/components/landing/light/landing-navbar-light";
import { HeroLight } from "@/components/landing/light/hero-light";
import { PositioningSection } from "@/components/landing/light/positioning-section";
import { HiringStudioSection } from "@/components/landing/light/hiring-studio-section";
import { UseCasesSection } from "@/components/landing/light/use-cases-section";
import { ChannelsSection } from "@/components/landing/light/channels-section";
import { PerformanceSection } from "@/components/landing/light/performance-section";
import { ModelHubSection } from "@/components/landing/light/model-hub-section";
import { PricingSection } from "@/components/landing/light/pricing-section";
import { FinalCtaLight } from "@/components/landing/light/final-cta-light";
import { LandingFooterLight } from "@/components/landing/light/landing-footer-light";
import { PLANS_IN_ORDER } from "@/modules/billing/plans";

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

describe("Landing page (Sprint 020 — light theme)", () => {
  it("renders the navbar with brand, links, and the hire CTA to /signup", () => {
    const { getAllByText, getByLabelText } = render(<LandingNavbarLight />);
    expect(getByLabelText("Taurus AI home")).toBeTruthy();
    const ctas = getAllByText("Hire your first AI Employee");
    expect(ctas.length).toBeGreaterThan(0);
    expect(ctas[0].closest("a")?.getAttribute("href")).toBe("/signup");
  });

  it("renders the hero with the category headline and both CTAs", () => {
    const { getByText, container } = render(<HeroLight />);
    expect(container.textContent).toContain("Hire");
    expect(container.textContent).toContain("Not");
    expect(container.textContent).toContain("another");
    expect(container.textContent).toContain("chatbot.");
    expect(getByText("Hire your first AI Employee").closest("a")?.getAttribute("href")).toBe(
      "/signup",
    );
    expect(getByText("See how it works").closest("a")?.getAttribute("href")).toBe("#how-it-works");
  });

  it("renders the positioning contrast: a quarter vs an afternoon", () => {
    const { container } = render(<PositioningSection />);
    expect(container.textContent).toContain("a quarter and a deployment team.");
    expect(container.textContent).toContain("an afternoon.");
  });

  it("renders the four-step Hiring Studio walkthrough", () => {
    const { container } = render(<HiringStudioSection />);
    expect(container.textContent).toContain("From idea to deployed AI Employee in four steps.");
    for (const step of ["Choose a role", "Shape the DNA", "Add your knowledge", "Test, then deploy"]) {
      expect(container.textContent).toContain(step);
    }
  });

  it("renders five use cases with an honest illustrative-scenarios disclosure", () => {
    const { container } = render(<UseCasesSection />);
    for (const domain of [
      "E-commerce & Retail",
      "Clinics & Healthcare",
      "Professional Services",
      "SaaS & Support",
      "Operations & HR",
    ]) {
      expect(container.textContent).toContain(domain);
    }
    expect(container.textContent).toContain("The problem");
    expect(container.textContent).toContain("With a Taurus AI Employee");
    expect(container.textContent).toContain("Illustrative scenarios");
  });

  it("renders the three channels: Website, WhatsApp + SMS, Phone", () => {
    const { container } = render(<ChannelsSection />);
    expect(container.textContent).toContain("One Employee. Every channel.");
    expect(container.textContent).toContain("Website");
    expect(container.textContent).toContain("WhatsApp + SMS");
    expect(container.textContent).toContain("Phone");
  });

  it("renders the performance scorecard trust section", () => {
    const { container } = render(<PerformanceSection />);
    expect(container.textContent).toContain("Performance Review");
    expect(container.textContent).toContain("Answers from your knowledge");
    expect(container.textContent).toContain("Stays within boundaries");
  });

  it("renders the Model Hub no-lock-in section", () => {
    const { container } = render(<ModelHubSection />);
    expect(container.textContent).toContain("Any model. No lock-in.");
    expect(container.textContent).toContain("Managed by default");
  });

  it("renders pricing from the plans catalog with no hard-coded prices", () => {
    const { container } = render(<PricingSection />);
    for (const plan of PLANS_IN_ORDER) {
      expect(container.textContent).toContain(plan.name);
      const price = plan.isFree ? "Free" : `$${plan.monthlyPriceUsd}`;
      expect(container.textContent).toContain(price);
    }
  });

  it("routes the final CTAs to the real auth pages", () => {
    const { getByText } = render(<FinalCtaLight />);
    expect(getByText("Get started").closest("a")?.getAttribute("href")).toBe("/signup");
    expect(getByText("Sign in").closest("a")?.getAttribute("href")).toBe("/login");
  });

  it("renders the footer with brand and navigation columns", () => {
    const { container } = render(<LandingFooterLight />);
    for (const label of ["Product", "Platform", "Get started", "All rights reserved."]) {
      expect(container.textContent).toContain(label);
    }
  });
});
