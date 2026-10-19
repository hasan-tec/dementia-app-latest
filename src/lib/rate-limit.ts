/**
 * Rate Limiter
 * Provides sliding-window rate limiting per authenticated account.
 * Configured with local memory store for development, pluggable for Redis/Upstash in production.
 */

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimitOptions {
  windowMs: number; // e.g. 60_000 for 1 minute
  maxRequests: number; // e.g. 10 requests per minute
}

class SlidingWindowRateLimiter {
  private store = new Map<string, RateLimitRecord>();

  /**
   * Checks whether the given key (e.g. userId) is within rate limits.
   * Returns { allowed: boolean, remaining: number, resetMs: number }
   */
  public check(key: string, options: RateLimitOptions): {
    allowed: boolean;
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();
    const windowStart = now - options.windowMs;

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    // Clean old timestamps outside the sliding window
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    if (record.timestamps.length >= options.maxRequests) {
      const oldestTimestamp = record.timestamps[0];
      const resetMs = oldestTimestamp + options.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, resetMs),
      };
    }

    // Allow and record
    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: options.maxRequests - record.timestamps.length,
      resetMs: options.windowMs,
    };
  }

  /**
   * Periodically garbage collects empty or stale keys
   */
  public cleanup(maxAgeMs: number = 300_000): void {
    const threshold = Date.now() - maxAgeMs;
    for (const [key, record] of this.store.entries()) {
      record.timestamps = record.timestamps.filter(ts => ts > threshold);
      if (record.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

export const globalRateLimiter = new SlidingWindowRateLimiter();

// AI generation limiter default: 10 calls per minute per user
export const AI_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  maxRequests: 10,
};

// General mutation limiter default: 60 mutations per minute per user
export const MUTATION_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  maxRequests: 60,
};
