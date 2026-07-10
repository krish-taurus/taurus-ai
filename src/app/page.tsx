/**
 * Taurus AI landing page (Sprint 055 — Landing v3, cinematic monochrome).
 *
 * One continuous product story on a white canvas: hire intelligence → see the
 * operating system → watch it built in five steps → the Control Centre → six
 * STAR use-case films → employees working together → the whole platform →
 * models, security, teams, performance → pricing, FAQ, contact → the closing
 * scene. Marketing surface only: pricing reads the code-authoritative plans
 * catalog, CTAs route to the real auth pages, structured data mirrors on-page
 * copy. Every scenario is labelled illustrative — no invented customers.
 */

import type { Metadata } from "next";
import { LandingShell } from "@/components/landing/v3/shell";
import { LandingNavbar } from "@/components/landing/v3/navbar";
import { Hero } from "@/components/landing/v3/hero";
import { Marquee } from "@/components/landing/v3/motion";
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

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://thetaurus.ai";

export const metadata: Metadata = {
  title: "Taurus AI | Build and Deploy Enterprise AI Employees",
  description:
    "Create specialised AI Employees that understand your business, use your tools and automate real workflows. Build, deploy and manage your AI workforce with Taurus AI.",
  alternates: { canonical: SITE_URL },
  keywords: [
    "AI employees",
    "AI workforce",
    "autonomous AI employees",
    "AI employee platform",
    "enterprise AI automation",
    "digital workforce platform",
    "AI operating system",
    "build AI employees",
    "hire AI employees",
  ],
  openGraph: {
    title: "Taurus AI | Build and Deploy Enterprise AI Employees",
    description:
      "Hire AI Employees. Train them on your business. Deploy them in minutes. The operating system for your AI workforce.",
    url: SITE_URL,
    siteName: "Taurus AI",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Taurus AI | Build and Deploy Enterprise AI Employees",
    description:
      "Hire AI Employees. Train them on your business. Deploy them in minutes. The operating system for your AI workforce.",
  },
};

const MARQUEE_ITEMS = [
  "Hiring Studio",
  "Employee DNA",
  "Knowledge Vault",
  "Website chat",
  "WhatsApp",
  "SMS",
  "Email",
  "Slack",
  "Microsoft Teams",
  "Telegram",
  "Phone calls",
  "Workflows",
  "Visual canvas",
  "Human approvals",
  "Scheduled triggers",
  "Marketplace",
  "Model Hub",
  "Performance Reviews",
  "Usage controls",
  "Audit log",
];

/** Structured data: Organization + SoftwareApplication + FAQPage. */
function structuredData() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Taurus AI",
      url: SITE_URL,
      email: "krishbhargav@thetaurus.ai",
      telephone: "+91 63634 02404",
      slogan: "The Operating System for AI Employees.",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+91 63634 02404",
        email: "krishbhargav@thetaurus.ai",
        contactType: "sales",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Taurus AI",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "Taurus AI is the enterprise platform for building, deploying and managing AI Employees — specialised digital team members that understand your business, use your tools, communicate across channels and execute real workflows with human oversight.",
      offers: PLANS_IN_ORDER.map((plan) => ({
        "@type": "Offer",
        name: `${plan.name} plan`,
        price: plan.monthlyPriceUsd,
        priceCurrency: "USD",
        description: plan.tagline,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];
}

export default function HomePage() {
  return (
    <LandingShell>
      <script
        type="application/ld+json"
        // Static, server-rendered structured data mirroring on-page content.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
      />
      <LandingNavbar />
      <main>
        <Hero />
        <div className="border-y border-neutral-100 py-5">
          <Marquee items={MARQUEE_ITEMS} />
        </div>
        <Positioning />
        <HowItWorks />
        <ControlCenter />
        <UseCases />
        <Collaboration />
        <Features />
        <ModelHub />
        <Security />
        <Teams />
        <Performance />
        <Pricing />
        <Faq />
        <Contact />
        <FinalCta />
      </main>
      <LandingFooter />
    </LandingShell>
  );
}
