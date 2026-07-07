import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  describeActorType,
  describeAuditAction,
  describeAuditTarget,
} from "@/modules/audit/metadata";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

/** How many recent events to show. */
const AUDIT_PAGE_SIZE = 100;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AuditPage() {
  const { organization, membership } = await requireCurrentOrganization();

  // Server-side permission check: only owner/admin may view the audit trail.
  if (!hasPermission(membership.role, "audit.view")) {
    redirect("/dashboard");
  }

  const store = getStore();
  const events = await store.listAuditEvents(organization.id, AUDIT_PAGE_SIZE);

  // Resolve the display name for user actors (org-scoped: these are actions taken
  // within this organization). Deduplicated so we look up each user only once.
  const userActorIds = Array.from(
    new Set(
      events.filter((e) => e.actorType === "user" && e.actorId).map((e) => e.actorId as string),
    ),
  );
  const actorNames = new Map<string, string>();
  await Promise.all(
    userActorIds.map(async (id) => {
      const user = await store.getUserById(id);
      if (user) actorNames.set(id, user.fullName?.trim() || user.email);
    }),
  );

  const actorLabel = (event: (typeof events)[number]): string => {
    if (event.actorType === "user" && event.actorId) {
      return actorNames.get(event.actorId) ?? describeActorType(event.actorType);
    }
    return describeActorType(event.actorType);
  };

  return (
    <div>
      <PageHeader
        title="Audit"
        description="A record of important actions taken across your organization."
      />

      {events.length === 0 ? (
        <EmptyState
          title="No audit events yet."
          description="Major actions in your organization will be recorded here."
        />
      ) : (
        <Card className="divide-y divide-taurus-line p-0">
          {events.map((event) => {
            const target = describeAuditTarget(event.targetType);
            return (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-taurus-text">
                    {describeAuditAction(event.action)}
                  </p>
                  <p className="mt-0.5 text-xs text-taurus-faint">
                    {actorLabel(event)}
                    {target ? <> · {target}</> : null}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {event.actorType !== "user" ? (
                    <Badge tone="outline">{describeActorType(event.actorType)}</Badge>
                  ) : null}
                  <time
                    dateTime={event.createdAt}
                    className="whitespace-nowrap text-xs text-taurus-faint"
                  >
                    {formatWhen(event.createdAt)}
                  </time>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
