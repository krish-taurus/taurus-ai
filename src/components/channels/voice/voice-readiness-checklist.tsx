/**
 * Voice readiness checklist (Prompt 010).
 */

import Link from "next/link";
import { StatusDot } from "@/components/ui";
import type { VoiceReadiness } from "@/modules/voice-runtime/readiness";

function Row({
  done,
  label,
  hint,
  cta,
}: {
  done: boolean;
  label: string;
  hint: string;
  cta?: { text: string; href: string };
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-1">
          <StatusDot level={done ? 3 : 0} />
        </span>
        <div>
          <p className="text-sm font-medium text-taurus-text">{label}</p>
          <p className="text-xs text-taurus-faint">{hint}</p>
        </div>
      </div>
      {!done && cta ? (
        <Link
          href={cta.href}
          className="shrink-0 text-xs font-medium text-taurus-sub hover:text-taurus-text"
        >
          {cta.text}
        </Link>
      ) : null}
    </li>
  );
}

export function VoiceReadinessChecklist({
  readiness,
  employeeId,
}: {
  readiness: VoiceReadiness;
  employeeId: string;
}) {
  return (
    <ul className="space-y-3">
      <Row
        done={readiness.employeeActive}
        label="Employee active"
        hint={readiness.employeeActive ? "Active." : "Activate this AI Employee first."}
        cta={{ text: "Open", href: `/dashboard/employees/${employeeId}` }}
      />
      <Row
        done={readiness.dnaPublished}
        label="Employee DNA published"
        hint={readiness.dnaPublished ? "Ready." : "Publish DNA so it can respond."}
        cta={{ text: "Configure", href: `/dashboard/employees/${employeeId}/dna` }}
      />
      <Row
        done={readiness.knowledgeAssigned}
        label="Knowledge assigned"
        hint={
          readiness.knowledgeAssigned
            ? "Assigned."
            : "Optional, but recommended for grounded answers."
        }
        cta={{ text: "Assign", href: `/dashboard/employees/${employeeId}/knowledge` }}
      />
      <Row
        done={readiness.brainReady}
        label="Employee Brain ready"
        hint={readiness.brainReady ? "Ready." : "Connect a model provider in Model Hub."}
        cta={{ text: "Open Model Hub", href: `/dashboard/settings/models` }}
      />
      <Row
        done={readiness.channelActive}
        label="Voice Channel active"
        hint={readiness.channelActive ? "Active." : "Activate this Voice Channel."}
      />
      <Row
        done={readiness.phoneNumberConfigured}
        label="Phone number configured"
        hint={readiness.phoneNumberConfigured ? "Added." : "Add a phone number above."}
      />
      <Row
        done={readiness.sttConfigured}
        label="Speech understanding ready"
        hint={readiness.sttConfigured ? "Ready (simulated or connected)." : "Choose a provider."}
      />
      <Row
        done={readiness.ttsConfigured}
        label="Speaking voice ready"
        hint={readiness.ttsConfigured ? "Ready (simulated or connected)." : "Choose a provider."}
      />
    </ul>
  );
}
