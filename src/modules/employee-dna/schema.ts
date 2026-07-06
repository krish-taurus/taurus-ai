/**
 * Employee DNA schema v1 (Prompt 005).
 *
 * Employee DNA is a structured, enterprise-safe description of who an AI Employee
 * is and how it works — an employee handbook, never a prompt. This module defines
 * the v1 shape, its validation, sensible defaults, and friendly labels. All enum
 * values are stored as human-readable display strings.
 *
 * The schema is intentionally lenient about emptiness (drafts are allowed to be
 * incomplete) but strict about structure and allowed choices.
 */

import { z } from "zod";

export const DNA_SCHEMA_VERSION = "1.0";

// --- Allowed choices (display strings) -------------------------------------

export const DNA_TONES = [
  "Friendly",
  "Professional",
  "Warm",
  "Direct",
  "Luxury",
  "Playful",
] as const;
export const DNA_FORMALITIES = ["Casual", "Balanced", "Formal"] as const;
export const DNA_EMPATHY_LEVELS = ["Low", "Medium", "High"] as const;
export const DNA_RESPONSE_LENGTHS = ["Short", "Balanced", "Detailed"] as const;
export const DNA_RISK_LEVELS = ["Conservative", "Balanced", "Proactive"] as const;
export const DNA_ESCALATION_PREFERENCES = [
  "Ask human when unsure",
  "Ask human before important actions",
  "Only escalate critical issues",
] as const;

export type DnaTone = (typeof DNA_TONES)[number];
export type DnaFormality = (typeof DNA_FORMALITIES)[number];
export type DnaEmpathyLevel = (typeof DNA_EMPATHY_LEVELS)[number];
export type DnaResponseLength = (typeof DNA_RESPONSE_LENGTHS)[number];
export type DnaRiskLevel = (typeof DNA_RISK_LEVELS)[number];
export type DnaEscalationPreference = (typeof DNA_ESCALATION_PREFERENCES)[number];

// --- Field helpers ----------------------------------------------------------

const shortText = z.string().trim().max(500);
const longText = z.string().trim().max(4000);
const stringList = z.array(z.string().trim().min(1).max(500)).max(50);

// --- Section schemas --------------------------------------------------------

export const identitySchema = z.object({
  mission: longText,
  roleSummary: shortText,
  primaryGoals: stringList,
  successCriteria: stringList,
});

export const responsibilitiesSchema = z.object({
  primaryResponsibilities: stringList,
  secondaryResponsibilities: stringList,
  outOfScopeResponsibilities: stringList,
});

export const communicationStyleSchema = z.object({
  tone: z.enum(DNA_TONES),
  formality: z.enum(DNA_FORMALITIES),
  empathyLevel: z.enum(DNA_EMPATHY_LEVELS),
  responseLength: z.enum(DNA_RESPONSE_LENGTHS),
  brandVoice: longText,
  languages: stringList,
});

export const decisionStyleSchema = z.object({
  riskLevel: z.enum(DNA_RISK_LEVELS),
  escalationPreference: z.enum(DNA_ESCALATION_PREFERENCES),
  whenToEscalate: longText,
  decisionBoundaries: stringList,
});

export const boundariesSchema = z.object({
  allowedTopics: stringList,
  restrictedTopics: stringList,
  neverDo: stringList,
  complianceNotes: longText,
});

export const companyContextSchema = z.object({
  companyDescription: longText,
  productsAndServices: longText,
  targetCustomers: longText,
  brandValues: stringList,
});

export const learningPolicySchema = z.object({
  askClarifyingQuestions: z.boolean(),
  admitUncertainty: z.boolean(),
  citeSourcesWhenAvailable: z.boolean(),
  escalateWhenPolicyRequires: z.boolean(),
});

export const dnaSchemaV1 = z.object({
  identity: identitySchema,
  responsibilities: responsibilitiesSchema,
  communicationStyle: communicationStyleSchema,
  decisionStyle: decisionStyleSchema,
  boundaries: boundariesSchema,
  companyContext: companyContextSchema,
  learningPolicy: learningPolicySchema,
});

export type EmployeeDnaV1 = z.infer<typeof dnaSchemaV1>;

// --- Defaults ---------------------------------------------------------------

/** A structurally valid, empty DNA with sensible, enterprise-safe defaults. */
export function createEmptyDnaV1(): EmployeeDnaV1 {
  return {
    identity: { mission: "", roleSummary: "", primaryGoals: [], successCriteria: [] },
    responsibilities: {
      primaryResponsibilities: [],
      secondaryResponsibilities: [],
      outOfScopeResponsibilities: [],
    },
    communicationStyle: {
      tone: "Professional",
      formality: "Balanced",
      empathyLevel: "Medium",
      responseLength: "Balanced",
      brandVoice: "",
      languages: [],
    },
    decisionStyle: {
      riskLevel: "Balanced",
      escalationPreference: "Ask human when unsure",
      whenToEscalate: "",
      decisionBoundaries: [],
    },
    boundaries: { allowedTopics: [], restrictedTopics: [], neverDo: [], complianceNotes: "" },
    companyContext: {
      companyDescription: "",
      productsAndServices: "",
      targetCustomers: "",
      brandValues: [],
    },
    learningPolicy: {
      askClarifyingQuestions: true,
      admitUncertainty: true,
      citeSourcesWhenAvailable: true,
      escalateWhenPolicyRequires: true,
    },
  };
}

/** Parse + normalize arbitrary input into a valid DNA (throws on bad structure). */
export function parseDnaV1(input: unknown): EmployeeDnaV1 {
  return dnaSchemaV1.parse(input);
}

// --- Friendly UI labels -----------------------------------------------------

export const LEARNING_POLICY_LABELS: Record<keyof EmployeeDnaV1["learningPolicy"], string> = {
  askClarifyingQuestions: "Ask clarifying questions when a request is unclear",
  admitUncertainty: "Admit when unsure instead of guessing",
  citeSourcesWhenAvailable: "Share sources when available",
  escalateWhenPolicyRequires: "Escalate when company policy requires it",
};
