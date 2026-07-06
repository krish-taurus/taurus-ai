/**
 * Rate limiting for public channels (Prompt 008).
 *
 * A small, dependency-free interface with an in-memory development limiter. It
 * limits by channel public key, by visitor/session, and by IP hash. The window
 * counters live on globalThis so they survive dev module reloads.
 *
 * PRODUCTION NOTE: this in-memory limiter is per-process and resets on deploy.
 * A production deployment should back `RateLimiter` with Redis (or similar) so
 * limits are shared across instances. The interface is designed for that swap.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): RateLimitResult;
}

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;

class InMemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    if (limit <= 0) return { allowed: true, retryAfterMs: 0 };
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0];
      return { allowed: false, retryAfterMs: Math.max(0, oldest + windowMs - now) };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return { allowed: true, retryAfterMs: 0 };
  }
}

/** Create a fresh in-memory rate limiter (used in tests). */
export function createRateLimiter(): RateLimiter {
  return new InMemoryRateLimiter();
}

const globalForLimiter = globalThis as unknown as { __taurusRateLimiter?: RateLimiter };

/** The process-wide development rate limiter. */
export function getRateLimiter(): RateLimiter {
  if (!globalForLimiter.__taurusRateLimiter) {
    globalForLimiter.__taurusRateLimiter = new InMemoryRateLimiter();
  }
  return globalForLimiter.__taurusRateLimiter;
}

export interface ChannelRateLimitInput {
  publicKey: string;
  sessionId: string | null;
  ipHash: string | null;
  perMinute: number;
  perDay: number;
}

/** Apply the per-minute and per-day limits across key, session, and IP. */
export function checkChannelRateLimits(
  limiter: RateLimiter,
  input: ChannelRateLimitInput,
): RateLimitResult {
  const scopes = [
    `key:${input.publicKey}`,
    input.sessionId ? `session:${input.sessionId}` : null,
    input.ipHash ? `ip:${input.ipHash}` : null,
  ].filter((s): s is string => s !== null);

  for (const scope of scopes) {
    const perMinute = limiter.check(`${scope}:m`, input.perMinute, MINUTE_MS);
    if (!perMinute.allowed) return perMinute;
    const perDay = limiter.check(`${scope}:d`, input.perDay, DAY_MS);
    if (!perDay.allowed) return perDay;
  }
  return { allowed: true, retryAfterMs: 0 };
}
