/**
 * Read-only Employee DNA summary (Prompt 005). Presentational, server-safe.
 *
 * Shows the currently published DNA as a friendly handbook, not an editor.
 */

import { LEARNING_POLICY_LABELS, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";

function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-slate-700">{value}</dd>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  const filled = items.filter((i) => i.trim());
  if (filled.length === 0) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1">
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
          {filled.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="mt-3 space-y-3">{children}</dl>
    </div>
  );
}

export function DnaSummary({ dna }: { dna: EmployeeDnaV1 }) {
  const yes = (v: boolean) => (v ? "Yes" : "No");

  return (
    <div className="space-y-4">
      <SummarySection title="Identity">
        <TextBlock label="Mission" value={dna.identity.mission} />
        <TextBlock label="Role summary" value={dna.identity.roleSummary} />
        <ListBlock label="Primary goals" items={dna.identity.primaryGoals} />
        <ListBlock label="Success looks like" items={dna.identity.successCriteria} />
      </SummarySection>

      <SummarySection title="Responsibilities">
        <ListBlock label="Primary" items={dna.responsibilities.primaryResponsibilities} />
        <ListBlock label="Secondary" items={dna.responsibilities.secondaryResponsibilities} />
        <ListBlock label="Out of scope" items={dna.responsibilities.outOfScopeResponsibilities} />
      </SummarySection>

      <SummarySection title="Communication Style">
        <TextBlock label="Tone" value={dna.communicationStyle.tone} />
        <TextBlock label="Formality" value={dna.communicationStyle.formality} />
        <TextBlock label="Empathy level" value={dna.communicationStyle.empathyLevel} />
        <TextBlock label="Response length" value={dna.communicationStyle.responseLength} />
        <TextBlock label="Brand voice" value={dna.communicationStyle.brandVoice} />
        <ListBlock label="Languages" items={dna.communicationStyle.languages} />
      </SummarySection>

      <SummarySection title="Decision Style">
        <TextBlock label="Risk level" value={dna.decisionStyle.riskLevel} />
        <TextBlock
          label="When to involve a person"
          value={dna.decisionStyle.escalationPreference}
        />
        <TextBlock label="Escalation notes" value={dna.decisionStyle.whenToEscalate} />
        <ListBlock label="Decision boundaries" items={dna.decisionStyle.decisionBoundaries} />
      </SummarySection>

      <SummarySection title="Boundaries">
        <ListBlock label="Allowed topics" items={dna.boundaries.allowedTopics} />
        <ListBlock label="Restricted topics" items={dna.boundaries.restrictedTopics} />
        <ListBlock label="Never do" items={dna.boundaries.neverDo} />
        <TextBlock label="Compliance notes" value={dna.boundaries.complianceNotes} />
      </SummarySection>

      <SummarySection title="Company Context">
        <TextBlock label="Company description" value={dna.companyContext.companyDescription} />
        <TextBlock label="Products and services" value={dna.companyContext.productsAndServices} />
        <TextBlock label="Target customers" value={dna.companyContext.targetCustomers} />
        <ListBlock label="Brand values" items={dna.companyContext.brandValues} />
      </SummarySection>

      <SummarySection title="Learning Policy">
        <TextBlock
          label={LEARNING_POLICY_LABELS.askClarifyingQuestions}
          value={yes(dna.learningPolicy.askClarifyingQuestions)}
        />
        <TextBlock
          label={LEARNING_POLICY_LABELS.admitUncertainty}
          value={yes(dna.learningPolicy.admitUncertainty)}
        />
        <TextBlock
          label={LEARNING_POLICY_LABELS.citeSourcesWhenAvailable}
          value={yes(dna.learningPolicy.citeSourcesWhenAvailable)}
        />
        <TextBlock
          label={LEARNING_POLICY_LABELS.escalateWhenPolicyRequires}
          value={yes(dna.learningPolicy.escalateWhenPolicyRequires)}
        />
      </SummarySection>
    </div>
  );
}
