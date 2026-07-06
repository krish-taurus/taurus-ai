/**
 * Channel catalog cards (Prompt 008).
 *
 * An at-a-glance grid of every channel grouped by category. Web channels are
 * "Available now"; the rest are "Coming soon" and are read-only (not clickable).
 */

import { Badge, Card } from "@/components/ui";
import {
  CHANNEL_CATEGORY_LABELS,
  CHANNEL_CATEGORY_ORDER,
  channelsInCategory,
} from "@/modules/channels/catalog";

export function ChannelCatalogCards() {
  return (
    <div className="space-y-8">
      {CHANNEL_CATEGORY_ORDER.map((category) => {
        const items = channelsInCategory(category);
        if (items.length === 0) return null;
        const anyAvailable = items.some((i) => i.availability === "available");
        return (
          <section key={category}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-taurus-text">
                {CHANNEL_CATEGORY_LABELS[category]}
              </h2>
              {anyAvailable ? (
                <Badge tone="solid">Available now</Badge>
              ) : (
                <Badge tone="outline">Coming soon</Badge>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const available = item.availability === "available";
                return (
                  <Card key={item.type} className={`p-4 ${available ? "" : "opacity-70"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-taurus-text">{item.label}</h3>
                      {available ? (
                        <Badge tone="soft">Available now</Badge>
                      ) : (
                        <Badge tone="outline">Coming soon</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-taurus-faint">{item.description}</p>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
