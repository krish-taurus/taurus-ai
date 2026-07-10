import { beforeAll, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LandingNavbar } from "@/components/landing/v3/navbar";
import { Hero } from "@/components/landing/v3/hero";
import { Positioning } from "@/components/landing/v3/positioning";
import { HowItWorks } from "@/components/landing/v3/how-it-works";
import { ControlCenter } from "@/components/landing/v3/control-center";
import { UseCases } from "@/components/landing/v3/use-cases";
import { Collaboration } from "@/components/landing/v3/collaboration";
import { Features } from "@/components/landing/v3/features";
import { ModelHub } from "@/components/landing/v3/model-hub";
import { Security } from "@/components/landing/v3/security";
import { Teams } from "@/components/landing/v3/teams";
import { Performance } from "@/components/landing/v3/performance";
import { Pricing } from "@/components/landing/v3/pricing";
import { Faq } from "@/components/landing/v3/faq";
import { Contact } from "@/components/landing/v3/contact";
import { FinalCta } from "@/components/landing/v3/final-cta";
import { LandingFooter } from "@/components/landing/v3/footer";
import { FAQ_ITEMS } from "@/components/landing/v3/faq-data";
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

describe("Landing page (Sprint 055 — Landing v3)", () => {
  it("renders the navbar with brand, story links, and the build CTA to /signup", () => {
    const { getAllByText, getByLabelText } = render(<LandingNavbar />);
    expect(getByLabelText("Taurus AI home")).toBeTruthy();
    const ctas = getAllByText("Build your first AI Employee");
    expect(ctas.length).toBeGreaterThan(0);
    expect(ctas[0].closest("a")?.getAttribute("href")).toBe("/signup");
  });

  it("renders the hero headline, rotating promise, both CTAs and the trust line", () => {
    const { container, getByText } = render(<Hero />);
    expect(container.textContent).toContain("Your company can");
    expect(container.textContent).toContain("hire intelligence.");
    expect(container.textContent).toContain(
      "Hire AI Employees. Train them on your business. Deploy them in minutes.",
    );
    expect(getByText("Build your first AI Employee").closest("a")?.getAttribute("href")).toBe("/signup");
    expect(getByText("See Taurus AI in action").closest("a")?.getAttribute("href")).toBe("#how-it-works");
    expect(container.textContent).toContain("No credit card required");
  });

  it("renders the positioning contrast between AI tools and the operating system", () => {
    const { container } = render(<Positioning />);
    expect(container.textContent).toContain("Traditional AI tools");
    expect(container.textContent).toContain("Persistent employee identity");
    expect(container.textContent).toContain("Human approval checkpoints");
    expect(container.textContent).toContain("AI Employees that work together");
  });

  it("renders all five How-It-Works steps (desktop rail + mobile story)", () => {
    const { container } = render(<HowItWorks />);
    for (const step of [
      "Choose a role",
      "Shape the Employee DNA",
      "Load the Knowledge Vault",
      "Connect tools and channels",
      "Deploy and improve",
    ]) {
      expect(container.textContent).toContain(step);
    }
  });

  it("renders the Control Centre with the employee directory and governance", () => {
    const { container } = render(<ControlCenter />);
    expect(container.textContent).toContain("Control Centre");
    for (const name of ["Nova", "Juno", "Atlas", "Vega"]) {
      expect(container.textContent).toContain(name);
    }
    expect(container.textContent).toContain("Full audit trail");
  });

  it("renders six STAR use-case stories with the illustrative disclosure", () => {
    const { container } = render(<UseCases />);
    for (const tag of [
      "AI Sales Employee",
      "AI Support Employee",
      "AI Recruitment Employee",
      "AI Data Analyst",
      "AI Operations Employee",
      "Executive AI Assistant",
    ]) {
      expect(container.textContent).toContain(tag);
    }
    expect(container.textContent).toContain("Situation");
    expect(container.textContent).toContain("Task");
    expect(container.textContent).toContain("Result");
    expect(container.textContent).toContain("Illustrative scenarios");
  });

  it("renders the collaboration workflow with a human approval gate", () => {
    const { container } = render(<Collaboration />);
    expect(container.textContent).toContain("work together");
    expect(container.textContent).toContain("Human manager");
    expect(container.textContent).toContain("approves the proposal");
  });

  it("renders the full platform feature wall", () => {
    const { container } = render(<Features />);
    for (const feature of [
      "Hiring Studio",
      "Employee DNA",
      "Knowledge Vault",
      "Workflows & visual canvas",
      "Human approvals",
      "AI Employee Marketplace",
      "Model Hub",
      "Performance Reviews",
      "Audit log",
      "Roles & permissions",
      "QR reach",
    ]) {
      expect(container.textContent).toContain(feature);
    }
  });

  it("renders the Model Hub routing story", () => {
    const { container } = render(<ModelHub />);
    expect(container.textContent).toContain("Bring your own provider API keys");
    expect(container.textContent).toContain("Switch providers without rebuilding the employee");
  });

  it("renders the security section with the four control pillars", () => {
    const { container } = render(<Security />);
    for (const pillar of ["Access", "Governance", "Transparency", "Human oversight"]) {
      expect(container.textContent).toContain(pillar);
    }
    expect(container.textContent).toContain("Complete audit trails");
  });

  it("renders the department selector with all eight teams", () => {
    const { container } = render(<Teams />);
    for (const dept of ["Sales", "Support", "Recruitment", "Marketing", "Operations", "Finance", "Data", "Leadership"]) {
      expect(container.textContent).toContain(dept);
    }
  });

  it("renders the performance scorecard and review", () => {
    const { container } = render(<Performance />);
    expect(container.textContent).toContain("Workforce scorecard");
    expect(container.textContent).toContain("Performance Review");
    expect(container.textContent).toContain("Answers from your knowledge");
  });

  it("renders pricing from the plans catalog with no hard-coded prices", () => {
    const { container } = render(<Pricing />);
    for (const plan of PLANS_IN_ORDER) {
      expect(container.textContent).toContain(plan.name);
      const price = plan.isFree ? "Free" : `$${plan.monthlyPriceUsd}`;
      expect(container.textContent).toContain(price);
    }
    expect(container.textContent).toContain("Enterprise");
    expect(container.textContent).toContain("Talk to sales");
  });

  it("renders every FAQ question from the shared data module", () => {
    const { container } = render(<Faq />);
    for (const item of FAQ_ITEMS) {
      expect(container.textContent).toContain(item.q);
    }
  });

  it("renders the contact section with the real phone, email and demo form", () => {
    const { container, getByLabelText } = render(<Contact />);
    expect(container.textContent).toContain("+91 63634 02404");
    expect(container.textContent).toContain("krishbhargav@thetaurus.ai");
    expect(getByLabelText("Your name")).toBeTruthy();
    expect(getByLabelText("Work email")).toBeTruthy();
    expect(getByLabelText("What would you like to automate?")).toBeTruthy();
  });

  it("renders the final cinematic CTA with both conversion paths", () => {
    const { container, getByText } = render(<FinalCta />);
    expect(container.textContent).toContain("is not human.");
    expect(container.textContent).toContain("Build your AI workforce");
    expect(getByText("Build your first AI Employee").closest("a")?.getAttribute("href")).toBe("/signup");
    expect(getByText("Book a personalised demo").closest("a")?.getAttribute("href")).toBe("#contact");
  });

  it("renders the footer with contact details and the brand statement", () => {
    const { container } = render(<LandingFooter />);
    expect(container.textContent).toContain("+91 63634 02404");
    expect(container.textContent).toContain("krishbhargav@thetaurus.ai");
    expect(container.textContent).toContain("Taurus AI — The Operating System for AI Employees.");
    expect(container.textContent).toContain("All rights reserved.");
  });
});
