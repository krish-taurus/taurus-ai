/**
 * Onboarding activation steps (Sprint 020).
 *
 * The five first-run steps a new organization walks through to get its first AI
 * Employee live. Pure metadata — completion is derived from real data in the
 * service, so there is no parallel "step done" flag to keep in sync. Each step
 * names the permission required to *act* on it, so viewers see progress without
 * being prompted for owner/admin-only actions.
 */

import type { Permission } from "@/modules/organizations/roles";

export type OnboardingStepKey = "hire" | "dna" | "knowledge" | "test_chat" | "deploy_web";

export interface OnboardingStepDef {
  key: OnboardingStepKey;
  title: string;
  description: string;
  /** The call-to-action label when the step is not yet complete. */
  actionLabel: string;
  /** Permission required to perform this step (role-respecting CTAs). */
  permission: Permission;
  /**
   * Optional steps count toward a richer setup but not toward "complete" — the
   * Knowledge Vault is genuinely optional for some roles (e.g. a Receptionist
   * that books appointments), so it is skippable.
   */
  optional?: boolean;
}

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    key: "hire",
    title: "Hire your first AI Employee",
    description: "Pick a role in the Hiring Studio. A template pre-fills the DNA so you start fast.",
    actionLabel: "Hire AI Employee",
    permission: "employee.create",
  },
  {
    key: "dna",
    title: "Give your AI Employee its DNA",
    description:
      "Publish the DNA — mission, responsibilities, boundaries — or accept the template default.",
    actionLabel: "Open Employee DNA",
    permission: "employee_dna.edit",
  },
  {
    key: "knowledge",
    title: "Add a Knowledge Vault source",
    description: "Give your AI Employee approved company knowledge to answer from. Optional.",
    actionLabel: "Add Knowledge",
    permission: "knowledge.manage",
    optional: true,
  },
  {
    key: "test_chat",
    title: "Test your AI Employee in chat",
    description: "Have a real conversation to see how it responds before you deploy.",
    actionLabel: "Test in chat",
    permission: "employee_chat.use",
  },
  {
    key: "deploy_web",
    title: "Deploy to your website",
    description: "Add the web widget so visitors can talk to your AI Employee.",
    actionLabel: "Deploy web widget",
    permission: "channel.manage",
  },
] as const;
