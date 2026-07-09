/**
 * A published AI Employee resume (Sprint 030). Renders the DNA snapshot + performance
 * summary + vault descriptions. Pure display — it only ever receives the listing
 * snapshot, never any live tenant data.
 */

import type { MarketplaceListing } from "@/lib/db/types";
import { Badge, Card } from "@/components/ui";

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-taurus-faint">
        {title}
      </h3>
      <div className="space-y-3 text-sm text-taurus-text">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <p>
      <span className="font-medium text-taurus-sub">{label}: </span>
      {value}
    </p>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  const clean = items.filter((i) => i && i.trim());
  if (clean.length === 0) return null;
  return (
    <div>
      <p className="font-medium text-taurus-sub">{label}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-taurus-text">
        {clean.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export function ResumeView({ listing }: { listing: MarketplaceListing }) {
  const dna = listing.dnaSnapshot;
  const perf = listing.performanceSnapshot;

  return (
    <div className="space-y-6">
      {listing.summary ? (
        <Card className="p-5 text-sm text-taurus-text">{listing.summary}</Card>
      ) : null}

      {/* Performance / achievements */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-taurus-faint">
          Performance
        </h3>
        {perf.reviewCount === 0 ? (
          <p className="text-sm text-taurus-sub">No performance reviews yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-2xl font-semibold text-taurus-text">{pct(perf.bestScore)}</div>
              <div className="text-xs text-taurus-faint">Best score</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-taurus-text">{pct(perf.latestScore)}</div>
              <div className="text-xs text-taurus-faint">Latest score</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-taurus-text">{pct(perf.passRate)}</div>
              <div className="text-xs text-taurus-faint">Pass rate</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-taurus-text">{perf.reviewCount}</div>
              <div className="text-xs text-taurus-faint">Reviews</div>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-6 p-5">
        <Section title="Identity">
          <Field label="Mission" value={dna.identity.mission} />
          <Field label="Role" value={dna.identity.roleSummary} />
          <ListField label="Primary goals" items={dna.identity.primaryGoals} />
          <ListField label="Success criteria" items={dna.identity.successCriteria} />
        </Section>

        <Section title="Responsibilities">
          <ListField label="Primary" items={dna.responsibilities.primaryResponsibilities} />
          <ListField label="Secondary" items={dna.responsibilities.secondaryResponsibilities} />
          <ListField label="Out of scope" items={dna.responsibilities.outOfScopeResponsibilities} />
        </Section>

        <Section title="Communication style">
          <div className="flex flex-wrap gap-2">
            <Badge tone="outline">{dna.communicationStyle.tone}</Badge>
            <Badge tone="outline">{dna.communicationStyle.formality}</Badge>
            <Badge tone="outline">empathy: {dna.communicationStyle.empathyLevel}</Badge>
            <Badge tone="outline">{dna.communicationStyle.responseLength}</Badge>
          </div>
          <Field label="Brand voice" value={dna.communicationStyle.brandVoice} />
          <ListField label="Languages" items={dna.communicationStyle.languages} />
        </Section>

        <Section title="Decision style">
          <div className="flex flex-wrap gap-2">
            <Badge tone="outline">risk: {dna.decisionStyle.riskLevel}</Badge>
            <Badge tone="outline">escalation: {dna.decisionStyle.escalationPreference}</Badge>
          </div>
          <Field label="When to escalate" value={dna.decisionStyle.whenToEscalate} />
          <ListField label="Decision boundaries" items={dna.decisionStyle.decisionBoundaries} />
        </Section>

        <Section title="Boundaries">
          <ListField label="Allowed topics" items={dna.boundaries.allowedTopics} />
          <ListField label="Restricted topics" items={dna.boundaries.restrictedTopics} />
          <ListField label="Never do" items={dna.boundaries.neverDo} />
        </Section>
      </Card>

      {/* Vaults (descriptions only — content never leaves the owner's org) */}
      {listing.includeVaults && listing.vaultSnapshot.length > 0 ? (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-taurus-faint">
            Knowledge it was trained with
          </h3>
          <p className="mb-3 text-xs text-taurus-faint">
            Descriptions only — the actual vault content is never shared. You attach your own
            knowledge after hiring.
          </p>
          <ul className="space-y-2">
            {listing.vaultSnapshot.map((v, idx) => (
              <li key={idx} className="rounded-lg border border-taurus-line bg-taurus-muted p-3">
                <p className="text-sm font-medium text-taurus-text">{v.name}</p>
                {v.description ? (
                  <p className="mt-0.5 text-sm text-taurus-sub">{v.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
