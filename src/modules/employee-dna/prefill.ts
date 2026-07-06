/**
 * Employee DNA prefill (Prompt 005).
 *
 * Builds a sensible starting DNA from what we already know about an AI Employee:
 * its name, role, department, description, Hiring-Studio responsibilities, and
 * working style. This is pure — it never writes to the database. A draft is only
 * persisted when the user explicitly saves.
 */

import type {
  AiEmployee,
  EmployeeEscalation,
  EmployeeFormality,
  EmployeeRiskLevel,
  EmployeeTone,
} from "@/lib/db/types";
import {
  createEmptyDnaV1,
  type DnaEscalationPreference,
  type DnaFormality,
  type DnaRiskLevel,
  type DnaTone,
  type EmployeeDnaV1,
} from "@/modules/employee-dna/schema";

// Working-style choices from the Hiring Studio map 1:1 onto DNA display values.
const TONE_MAP: Record<EmployeeTone, DnaTone> = {
  friendly: "Friendly",
  professional: "Professional",
  warm: "Warm",
  direct: "Direct",
  luxury: "Luxury",
  playful: "Playful",
};
const FORMALITY_MAP: Record<EmployeeFormality, DnaFormality> = {
  casual: "Casual",
  balanced: "Balanced",
  formal: "Formal",
};
const RISK_MAP: Record<EmployeeRiskLevel, DnaRiskLevel> = {
  conservative: "Conservative",
  balanced: "Balanced",
  proactive: "Proactive",
};
const ESCALATION_MAP: Record<EmployeeEscalation, DnaEscalationPreference> = {
  ask_when_unsure: "Ask human when unsure",
  ask_before_important: "Ask human before important actions",
  only_critical: "Only escalate critical issues",
};

export function buildDnaPrefill(employee: AiEmployee): EmployeeDnaV1 {
  const dna = createEmptyDnaV1();

  dna.identity.roleSummary = employee.department
    ? `${employee.roleTitle} in ${employee.department}`
    : employee.roleTitle;
  if (employee.description) {
    dna.identity.mission = employee.description;
  }

  dna.responsibilities.primaryResponsibilities = [...employee.responsibilities];

  if (employee.workingStyle) {
    dna.communicationStyle.tone = TONE_MAP[employee.workingStyle.tone];
    dna.communicationStyle.formality = FORMALITY_MAP[employee.workingStyle.formality];
    dna.decisionStyle.riskLevel = RISK_MAP[employee.workingStyle.riskLevel];
    dna.decisionStyle.escalationPreference = ESCALATION_MAP[employee.workingStyle.escalation];
  }

  return dna;
}
