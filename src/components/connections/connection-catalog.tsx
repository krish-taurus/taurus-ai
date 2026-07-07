/**
 * Connection catalog (Sprint 014) — every connection type Taurus offers.
 *
 * Server-safe + presentational. Shows all connection types with a clear
 * availability badge. Configurable types (available + foundation) link into the
 * "New connection" flow; coming-soon types are clearly marked and inert.
 */

import Link from "next/link";
import {
  CONNECTION_AVAILABILITY_LABELS,
  CONNECTION_TYPE_ORDER,
  connectionAvailability,
  connectionTypeDescription,
  connectionTypeLabel,
} from "@/modules/channels/connections";
import { Badge, buttonClasses, Card } from "@/components/ui";

export function ConnectionCatalog({ canManage }: { canManage: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CONNECTION_TYPE_ORDER.map((type) => {
        const availability = connectionAvailability(type);
        const configurable = availability !== "coming_soon";
        return (
          <Card key={type} className="flex h-full flex-col p-5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-taurus-text">
                {connectionTypeLabel(type)}
              </h3>
              <Badge
                tone={
                  availability === "available"
                    ? "solid"
                    : availability === "foundation"
                      ? "soft"
                      : "outline"
                }
              >
                {CONNECTION_AVAILABILITY_LABELS[availability]}
              </Badge>
            </div>
            <p className="flex-1 text-xs leading-relaxed text-taurus-faint">
              {connectionTypeDescription(type)}
            </p>
            <div className="mt-4">
              {configurable && canManage ? (
                <Link
                  href={`/dashboard/connections/new?type=${type}`}
                  className={buttonClasses("secondary", "sm")}
                >
                  Configure
                </Link>
              ) : configurable ? (
                <span className="text-xs text-taurus-faint">Ask an admin to configure this.</span>
              ) : (
                <span className="text-xs text-taurus-faint">Not available yet.</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
