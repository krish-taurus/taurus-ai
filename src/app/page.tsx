/**
 * Taurus AI landing page (Premium Landing v2).
 *
 * A cinematic, monochrome marketing experience: hero workforce network, the
 * scattered-AI problem, the operating-system grid, an animated six-step product
 * walkthrough, workforce/DNA/Vault/Model Hub/Channels/Inbox showcases,
 * enterprise trust, the future ecosystem, and the closing hire moment.
 *
 * Marketing surface only — no product logic. CTAs route to /signup and /login.
 */

import { LandingShell } from "@/components/landing/landing-shell";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Hero } from "@/components/landing/hero";
import { ProblemSection } from "@/components/landing/problem-section";
import { SolutionGrid } from "@/components/landing/solution-grid";
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

export default function HomePage() {
  return (
    <LandingShell>
      <LandingNavbar />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionGrid />
        <AnimatedWorkflow />
        <EmployeeCardShowcase />
        <DnaPanel />
        <KnowledgeVaultAnimation />
        <ModelHubAnimation />
        <ChannelsAnimation />
        <InboxAnimation />
        <TrustGrid />
        <EcosystemSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </LandingShell>
  );
}
