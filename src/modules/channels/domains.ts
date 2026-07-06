/**
 * Origin / domain allowlist enforcement (Prompt 008).
 *
 * Public widget + API requests are validated server-side against the channel's
 * allowed domains. Localhost is always allowed in development. This is a
 * defense-in-depth control — it is never the ONLY check (channel status, employee
 * status, and published DNA are all enforced too).
 */

/** Extract a bare hostname from an Origin/Referer header value. */
export function hostnameFromOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    // Some referers are bare hostnames.
    const cleaned = origin
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, "");
    return cleaned || null;
  }
}

/** Normalize an admin-entered domain to a comparable hostname. */
export function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  const withoutScheme = trimmed.replace(/^https?:\/\//, "");
  const host = withoutScheme.split("/")[0];
  return host.replace(/^www\./, "");
}

function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

export interface OriginCheck {
  allowed: boolean;
  hostname: string | null;
  reason: "ok" | "no_origin" | "not_allowed" | "no_domains_configured";
}

/**
 * Decide whether a request origin is allowed for a channel.
 *
 * Rules:
 *  - Localhost is always allowed in development.
 *  - If the channel has an allowlist, the origin hostname must match (or be a
 *    subdomain of) an entry.
 *  - If the allowlist is empty: allowed in development; in production, widget/API
 *    requests require a configured domain (callers decide whether to enforce for
 *    the hosted page, which may run without an allowlist).
 */
export function checkOrigin(
  origin: string | null | undefined,
  allowedDomains: string[],
  options: { isDevelopment: boolean },
): OriginCheck {
  const hostname = hostnameFromOrigin(origin);

  if (hostname && isLocalhost(hostname) && options.isDevelopment) {
    return { allowed: true, hostname, reason: "ok" };
  }

  const normalizedAllowed = allowedDomains.map(normalizeDomain).filter(Boolean);

  if (normalizedAllowed.length === 0) {
    // No allowlist configured.
    return {
      allowed: options.isDevelopment,
      hostname,
      reason: options.isDevelopment ? "ok" : "no_domains_configured",
    };
  }

  if (!hostname) {
    // An allowlist exists but the request sent no origin — reject.
    return { allowed: false, hostname: null, reason: "no_origin" };
  }

  const host = hostname.replace(/^www\./, "");
  const match = normalizedAllowed.some((d) => host === d || host.endsWith(`.${d}`));
  return {
    allowed: match,
    hostname,
    reason: match ? "ok" : "not_allowed",
  };
}
