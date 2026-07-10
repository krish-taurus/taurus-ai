/**
 * Dashboard navigation icons — crisp, monochrome line icons (stroke = currentColor)
 * so they inherit the active/inactive text color. One per nav destination, kept
 * to a consistent 20×20 / 1.6 stroke for an even optical weight.
 */

import type { SVGProps } from "react";

export type NavIconName =
  | "overview"
  | "employees"
  | "hire"
  | "marketplace"
  | "knowledge"
  | "workflows"
  | "models"
  | "connections"
  | "performance"
  | "collaboration"
  | "usage"
  | "billing"
  | "audit"
  | "settings";

function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

const ICONS: Record<NavIconName, (props: SVGProps<SVGSVGElement>) => JSX.Element> = {
  overview: (p) => (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Svg>
  ),
  employees: (p) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 20a5.5 5.5 0 0 0-2.7-4.7" />
    </Svg>
  ),
  workflows: (p) => (
    <Svg {...p}>
      <rect x="3" y="9.5" width="5" height="5" rx="1.2" />
      <rect x="16" y="4" width="5" height="5" rx="1.2" />
      <rect x="16" y="15" width="5" height="5" rx="1.2" />
      <path d="M8 12h4a2 2 0 0 0 2-2V6.5M8 12h4a2 2 0 0 1 2 2v3.5" />
    </Svg>
  ),
  marketplace: (p) => (
    <Svg {...p}>
      <path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
      <path d="M3.5 5.5h17l-1 4a2 2 0 0 1-2 1.6H6.5a2 2 0 0 1-2-1.6l-1-4Z" />
      <path d="M10 20v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4" />
    </Svg>
  ),
  hire: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 9.5-5.8" />
      <path d="M18 15v6M15 18h6" />
    </Svg>
  ),
  knowledge: (p) => (
    <Svg {...p}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5V5.5Z" />
    </Svg>
  ),
  models: (p) => (
    <Svg {...p}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3" />
    </Svg>
  ),
  connections: (p) => (
    <Svg {...p}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M7.6 7.6 10.6 16M16.4 7.6 13.4 16M8 6h8" />
    </Svg>
  ),
  performance: (p) => (
    <Svg {...p}>
      <path d="M4 4v16h16" />
      <path d="M8 15l3-4 3 2 4-6" />
    </Svg>
  ),
  collaboration: (p) => (
    <Svg {...p}>
      <path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M17 9h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v3l-3-2" />
    </Svg>
  ),
  usage: (p) => (
    <Svg {...p}>
      <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
      <path d="M14 3.5A9 9 0 0 1 20.5 10H14V3.5Z" />
    </Svg>
  ),
  billing: (p) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 9.5h18M6.5 14.5h4" />
    </Svg>
  ),
  audit: (p) => (
    <Svg {...p}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M13 3v5h5M9 13l2 2 4-4" />
    </Svg>
  ),
  settings: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </Svg>
  ),
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} />;
}
