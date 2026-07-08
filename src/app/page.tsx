/**
 * Taurus AI landing page (Sprint 020 — Landing Page, light theme).
 *
 * A bright, editorial marketing home: white background, near-black ink, dark
 * accents to highlight, oversized type, crisp inline-SVG imagery, and scroll-
 * revealed sections — with a step-by-step use-cases walkthrough as the centerpiece.
 * Built on the design system (monochrome tokens, inverted for light) with motion
 * that respects prefers-reduced-motion via the shell's MotionConfig.
 *
 * Marketing surface only — no product logic, no tenant data. Pricing is read from
 * the code-authoritative plans catalog. CTAs route to the real /signup and /login.
 */

import { LandingShellLight } from "@/components/landing/light/landing-shell-light";
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

export default function HomePage() {
  return (
    <LandingShellLight>
      <LandingNavbarLight />
      <main>
        <HeroLight />
        <PositioningSection />
        <HiringStudioSection />
        <UseCasesSection />
        <ChannelsSection />
        <PerformanceSection />
        <ModelHubSection />
        <PricingSection />
        <FinalCtaLight />
      </main>
      <LandingFooterLight />
    </LandingShellLight>
  );
}
