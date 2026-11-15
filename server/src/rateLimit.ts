// Sliding-window counter kept in memory: at most `limit` hits per key within `windowMs`.
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {
    // Drop keys whose hits have all expired, so the map doesn't grow forever.
    setInterval(() => {
      const now = Date.now();
      for (const [key, times] of this.hits) {
        if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
      }
    }, windowMs).unref();
  }

  private recent(key: string): number[] {
    const now = Date.now();
    const times = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, times);
    return times;
  }

  isLimited(key: string): boolean {
    return this.recent(key).length >= this.limit;
  }

  record(key: string): void {
    this.recent(key).push(Date.now());
  }
}
