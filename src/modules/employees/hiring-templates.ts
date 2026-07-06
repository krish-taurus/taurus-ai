/**
 * Hiring Studio templates and working-style metadata (Prompt 004).
 *
 * Everything here is plain, non-technical business language — roles a company
 * hires for and how an AI Employee should behave. No model, prompt, or vector
 * settings appear anywhere (the Grandmother Test). Pure data with no server
 * dependencies, so both server and client code may import it.
 */

import type {
  EmployeeEscalation,
  EmployeeFormality,
  EmployeeRiskLevel,
  EmployeeTone,
  WorkingStyle,
} from "@/lib/db/types";

// --- Working-style options + friendly labels -------------------------------

export const TONE_OPTIONS: readonly EmployeeTone[] = [
  "friendly",
  "professional",
  "warm",
  "direct",
  "luxury",
  "playful",
] as const;

export const TONE_LABELS: Record<EmployeeTone, string> = {
  friendly: "Friendly",
  professional: "Professional",
  warm: "Warm",
  direct: "Direct",
  luxury: "Luxury",
  playful: "Playful",
};

export const FORMALITY_OPTIONS: readonly EmployeeFormality[] = [
  "casual",
  "balanced",
  "formal",
] as const;

export const FORMALITY_LABELS: Record<EmployeeFormality, string> = {
  casual: "Casual",
  balanced: "Balanced",
  formal: "Formal",
};

export const RISK_OPTIONS: readonly EmployeeRiskLevel[] = [
  "conservative",
  "balanced",
  "proactive",
] as const;

export const RISK_LABELS: Record<EmployeeRiskLevel, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  proactive: "Proactive",
};

export const ESCALATION_OPTIONS: readonly EmployeeEscalation[] = [
  "ask_when_unsure",
  "ask_before_important",
  "only_critical",
] as const;

export const ESCALATION_LABELS: Record<EmployeeEscalation, string> = {
  ask_when_unsure: "Ask human when unsure",
  ask_before_important: "Ask human before important actions",
  only_critical: "Only escalate critical issues",
};

/** Short, human summary of a working style for the review + profile screens. */
export function summarizeWorkingStyle(style: WorkingStyle): string {
  return [
    TONE_LABELS[style.tone],
    FORMALITY_LABELS[style.formality],
    `${RISK_LABELS[style.riskLevel]} risk`,
  ].join(" · ");
}

// --- Role templates --------------------------------------------------------

export interface HiringTemplate {
  key: string;
  label: string;
  /** One-line pitch shown on the role card. */
  tagline: string;
  roleTitle: string;
  department: string;
  description: string;
  responsibilities: string[];
  workingStyle: WorkingStyle;
}

export const HIRING_TEMPLATES: readonly HiringTemplate[] = [
  {
    key: "receptionist",
    label: "Receptionist",
    tagline: "Greets people and routes requests.",
    roleTitle: "AI Receptionist",
    department: "Front Office",
    description: "Greets people, answers common questions, and routes requests to the right team.",
    responsibilities: [
      "Answer common customer questions",
      "Collect visitor or caller details",
      "Route requests to the right team",
      "Escalate uncertain or sensitive requests",
    ],
    workingStyle: {
      tone: "warm",
      formality: "balanced",
      riskLevel: "conservative",
      escalation: "ask_when_unsure",
    },
  },
  {
    key: "sales",
    label: "Sales",
    tagline: "Helps prospects and supports the sales team.",
    roleTitle: "AI Sales Assistant",
    department: "Sales",
    description: "Answers product questions, qualifies leads, and supports the sales team.",
    responsibilities: [
      "Answer product and pricing questions",
      "Qualify new leads",
      "Book meetings for the sales team",
      "Follow up with interested prospects",
    ],
    workingStyle: {
      tone: "professional",
      formality: "balanced",
      riskLevel: "proactive",
      escalation: "ask_before_important",
    },
  },
  {
    key: "customer_support",
    label: "Customer Support",
    tagline: "Answers questions and resolves issues.",
    roleTitle: "Customer Support AI",
    department: "Support",
    description: "Answers customer questions and helps resolve everyday support issues.",
    responsibilities: [
      "Answer common support questions",
      "Help customers resolve issues",
      "Explain policies and next steps",
      "Escalate complex problems to a human",
    ],
    workingStyle: {
      tone: "friendly",
      formality: "balanced",
      riskLevel: "conservative",
      escalation: "ask_when_unsure",
    },
  },
  {
    key: "hr",
    label: "HR",
    tagline: "Answers employee HR questions.",
    roleTitle: "HR Assistant AI",
    department: "People",
    description: "Answers employee HR questions and points people to the right resources.",
    responsibilities: [
      "Answer common HR and policy questions",
      "Help employees find the right forms",
      "Explain benefits and time-off policies",
      "Escalate sensitive matters to a human",
    ],
    workingStyle: {
      tone: "warm",
      formality: "formal",
      riskLevel: "conservative",
      escalation: "ask_before_important",
    },
  },
  {
    key: "finance",
    label: "Finance",
    tagline: "Helps with finance and expense questions.",
    roleTitle: "Finance Assistant AI",
    department: "Finance",
    description: "Helps the team with finance, expense, and invoicing questions.",
    responsibilities: [
      "Answer common finance and expense questions",
      "Explain invoicing and payment steps",
      "Help with expense policy questions",
      "Escalate approvals to a human",
    ],
    workingStyle: {
      tone: "professional",
      formality: "formal",
      riskLevel: "conservative",
      escalation: "ask_before_important",
    },
  },
  {
    key: "operations",
    label: "Operations",
    tagline: "Keeps routine work moving.",
    roleTitle: "Operations Assistant AI",
    department: "Operations",
    description: "Answers process questions and helps coordinate routine work.",
    responsibilities: [
      "Answer process and how-to questions",
      "Help coordinate routine tasks",
      "Share standard operating steps",
      "Escalate blockers to a human",
    ],
    workingStyle: {
      tone: "direct",
      formality: "balanced",
      riskLevel: "balanced",
      escalation: "only_critical",
    },
  },
  {
    key: "legal_assistant",
    label: "Legal Assistant",
    tagline: "Handles general policy questions.",
    roleTitle: "Legal Assistant AI",
    department: "Legal",
    description: "Helps with general policy questions and sends sensitive matters to a human.",
    responsibilities: [
      "Answer general policy questions",
      "Help locate standard documents",
      "Explain routine processes",
      "Escalate anything legal or sensitive to a human",
    ],
    workingStyle: {
      tone: "professional",
      formality: "formal",
      riskLevel: "conservative",
      escalation: "ask_before_important",
    },
  },
  {
    key: "marketing",
    label: "Marketing",
    tagline: "Supports content and brand consistency.",
    roleTitle: "Marketing Assistant AI",
    department: "Marketing",
    description: "Supports the marketing team with content ideas and brand-consistent answers.",
    responsibilities: [
      "Answer brand and campaign questions",
      "Draft simple content ideas",
      "Keep messaging consistent",
      "Escalate approvals to a human",
    ],
    workingStyle: {
      tone: "playful",
      formality: "casual",
      riskLevel: "proactive",
      escalation: "ask_before_important",
    },
  },
  {
    key: "custom",
    label: "Custom",
    tagline: "Start from scratch and define the role yourself.",
    roleTitle: "",
    department: "",
    description: "",
    responsibilities: [],
    workingStyle: {
      tone: "professional",
      formality: "balanced",
      riskLevel: "balanced",
      escalation: "ask_when_unsure",
    },
  },
] as const;

export const HIRING_TEMPLATE_KEYS = HIRING_TEMPLATES.map((t) => t.key);

export function getHiringTemplate(key: string): HiringTemplate | undefined {
  return HIRING_TEMPLATES.find((t) => t.key === key);
}
