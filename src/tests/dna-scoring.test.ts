import { describe, it, expect } from "vitest";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { computeDnaCompletion } from "@/modules/employee-dna/scoring";

function fullyFilled(): EmployeeDnaV1 {
  return {
    identity: {
      mission: "Help customers",
      roleSummary: "Support AI",
      primaryGoals: ["Resolve questions"],
      successCriteria: ["First-contact resolution"],
    },
    responsibilities: {
      primaryResponsibilities: ["Answer questions"],
      secondaryResponsibilities: ["Summarize"],
      outOfScopeResponsibilities: ["Refunds"],
    },
    communicationStyle: {
      tone: "Friendly",
      formality: "Balanced",
      empathyLevel: "High",
      responseLength: "Balanced",
      brandVoice: "Warm and clear",
      languages: ["English"],
    },
    decisionStyle: {
      riskLevel: "Conservative",
      escalationPreference: "Ask human when unsure",
      whenToEscalate: "Billing disputes",
      decisionBoundaries: ["No promises on dates"],
    },
    boundaries: {
      allowedTopics: ["Products"],
      restrictedTopics: ["Legal"],
      neverDo: ["Share personal data"],
      complianceNotes: "Follow GDPR",
    },
    companyContext: {
      companyDescription: "We sell software",
      productsAndServices: "SaaS",
      targetCustomers: "SMBs",
      brandValues: ["Honesty"],
    },
    learningPolicy: {
      askClarifyingQuestions: true,
      admitUncertainty: true,
      citeSourcesWhenAvailable: true,
      escalateWhenPolicyRequires: true,
    },
  };
}

describe("DNA completion scoring", () => {
  it("scores an empty DNA low (only the always-complete learning policy)", () => {
    const result = computeDnaCompletion(createEmptyDnaV1());
    // 6 empty categories at 0% + 1 learning policy at 100% => round(100/7) = 14
    expect(result.overall).toBe(14);
    expect(result.categories).toHaveLength(7);
    const learning = result.categories.find((c) => c.key === "learningPolicy");
    expect(learning?.complete).toBe(true);
  });

  it("scores a fully completed DNA at 100", () => {
    const result = computeDnaCompletion(fullyFilled());
    expect(result.overall).toBe(100);
    expect(result.categories.every((c) => c.complete)).toBe(true);
  });

  it("is deterministic", () => {
    const dna = fullyFilled();
    expect(computeDnaCompletion(dna)).toEqual(computeDnaCompletion(dna));
  });

  it("gives partial credit as sections are filled", () => {
    const dna = createEmptyDnaV1();
    dna.identity.mission = "Help customers";
    dna.identity.roleSummary = "Support AI";
    const result = computeDnaCompletion(dna);
    const identity = result.categories.find((c) => c.key === "identity");
    // 2 of 4 identity fields filled.
    expect(identity?.percent).toBe(50);
    expect(identity?.complete).toBe(false);
    expect(result.overall).toBeGreaterThan(14);
  });
});
