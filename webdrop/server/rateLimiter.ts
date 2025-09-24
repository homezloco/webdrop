// Simple IP-based token bucket rate limiter (extracted for unit testing)
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();
  constructor(private capacity: number, private refillPerSec: number) {}
  allow(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key) || { tokens: this.capacity, lastRefill: now };
    const elapsed = (now - bucket.lastRefill) / 1000;
    const refill = Math.floor(elapsed * this.refillPerSec);
    if (refill > 0) {
      bucket.tokens = Math.min(this.capacity, bucket.tokens + refill);
      bucket.lastRefill = now;
    }
    if (bucket.tokens <= 0) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return true;
  }
}
