/**
 * Employee DNA completion scoring (Prompt 005).
 *
 * A simple, deterministic 0–100 score based purely on which fields are filled.
 * No AI is used. Each of the seven sections is weighted equally; within a
 * section, credit is the fraction of its scored fields that are filled.
 */

import type { EmployeeDnaV1 } from "@/modules/employee-dna/schema";

export interface DnaCategoryScore {
  key: string;
  label: string;
  percent: number; // 0–100
  complete: boolean;
}

export interface DnaCompletion {
  overall: number; // 0–100
  categories: DnaCategoryScore[];
}

const filledString = (value: string): boolean => value.trim().length > 0;
const filledList = (value: string[]): boolean => value.some((item) => item.trim().length > 0);

/** Fraction (0–1) of the given checks that pass. */
function fraction(checks: boolean[]): number {
  if (checks.length === 0) return 1;
  return checks.filter(Boolean).length / checks.length;
}

export function computeDnaCompletion(dna: EmployeeDnaV1): DnaCompletion {
  const categories: DnaCategoryScore[] = [
    {
      key: "identity",
      label: "Identity",
      fraction: fraction([
        filledString(dna.identity.mission),
        filledString(dna.identity.roleSummary),
        filledList(dna.identity.primaryGoals),
        filledList(dna.identity.successCriteria),
      ]),
    },
    {
      key: "responsibilities",
      label: "Responsibilities",
      fraction: fraction([
        filledList(dna.responsibilities.primaryResponsibilities),
        filledList(dna.responsibilities.outOfScopeResponsibilities),
      ]),
    },
    {
      key: "communicationStyle",
      label: "Communication style",
      // Tone/formality/empathy/length always hold a valid choice; the free-form
      // fields are what make this section "complete".
      fraction: fraction([
        filledString(dna.communicationStyle.brandVoice),
        filledList(dna.communicationStyle.languages),
      ]),
    },
    {
      key: "decisionStyle",
      label: "Decision style",
      fraction: fraction([
        filledString(dna.decisionStyle.whenToEscalate),
        filledList(dna.decisionStyle.decisionBoundaries),
      ]),
    },
    {
      key: "boundaries",
      label: "Boundaries",
      fraction: fraction([
        filledList(dna.boundaries.allowedTopics),
        filledList(dna.boundaries.restrictedTopics),
        filledList(dna.boundaries.neverDo),
        filledString(dna.boundaries.complianceNotes),
      ]),
    },
    {
      key: "companyContext",
      label: "Company context",
      fraction: fraction([
        filledString(dna.companyContext.companyDescription),
        filledString(dna.companyContext.productsAndServices),
        filledString(dna.companyContext.targetCustomers),
        filledList(dna.companyContext.brandValues),
      ]),
    },
    {
      key: "learningPolicy",
      label: "Learning policy",
      // Booleans are always set; this section is considered complete once chosen.
      fraction: 1,
    },
  ].map((c) => ({
    key: c.key,
    label: c.label,
    percent: Math.round(c.fraction * 100),
    complete: c.fraction >= 1,
  }));

  const overall = Math.round(categories.reduce((sum, c) => sum + c.percent, 0) / categories.length);

  return { overall, categories };
}
