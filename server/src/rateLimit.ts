/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A simple per-address limit (a token bucket per IP and kind of request), in memory: enough for one API process.

export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  private readonly perMinute: number;

  constructor(perMinute: number) {
    this.perMinute = perMinute;
  }

  /** True when this address may make another request now. */
  allow(key: string, now: number): boolean {
    const bucket = this.buckets.get(key) ?? { tokens: this.perMinute, at: now };
    bucket.tokens = Math.min(this.perMinute, bucket.tokens + ((now - bucket.at) / 60000) * this.perMinute);
    bucket.at = now;
    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    if (this.buckets.size > 50000) this.forgetIdle(now);
    return allowed;
  }

  /** Drops addresses that have been quiet for a minute (their buckets are full again anyway). */
  private forgetIdle(now: number): void {
    for (const [key, bucket] of this.buckets) if (now - bucket.at > 60000) this.buckets.delete(key);
  }
}
