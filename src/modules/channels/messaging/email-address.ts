/**
 * Inbound email addressing (Sprint 040) — pure, client-safe.
 *
 * The zero-DNS "forwarding address" model: each email connection gets a unique
 * address `<publicKey>@<INBOUND_EMAIL_DOMAIN>`. The owner just forwards their
 * support inbox to it — no MX/DNS changes. A single domain-wide inbound webhook
 * (SendGrid Inbound Parse / Mailgun Route) posts every message for the domain to
 * one endpoint, which resolves the connection from the recipient address.
 */

/** URL sentinel for the domain-wide inbound webhook: /api/webhooks/channels/{provider}/inbound. */
export const INBOUND_EMAIL_ROUTE = "inbound";

/** The configured inbound email domain, or null when the forwarding model is off. */
export function inboundEmailDomain(): string | null {
  const raw = process.env.INBOUND_EMAIL_DOMAIN;
  return raw && raw.trim() ? raw.trim().toLowerCase() : null;
}

/** The unique forwarding address for a connection, or null when no domain is set. */
export function inboundAddressFor(publicKey: string): string | null {
  const domain = inboundEmailDomain();
  return domain ? `${publicKey}@${domain}` : null;
}

/**
 * Extract the connection public key from an inbound recipient header. Handles
 * `Name <tc_x@domain>`, bare addresses, and multiple comma/space-separated
 * recipients. Returns null if none match the configured inbound domain.
 */
export function extractPublicKeyFromRecipient(recipient: string | undefined | null): string | null {
  const domain = inboundEmailDomain();
  if (!domain || !recipient) return null;
  const matches = recipient.toLowerCase().match(/[^\s<>,;"']+@[^\s<>,;"']+/g) ?? [];
  for (const email of matches) {
    const [local, host] = email.split("@");
    if (host === domain && local) return local;
  }
  return null;
}
