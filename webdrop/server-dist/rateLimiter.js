"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
// Simple IP-based token bucket rate limiter (extracted for unit testing)
class RateLimiter {
    constructor(capacity, refillPerSec) {
        this.capacity = capacity;
        this.refillPerSec = refillPerSec;
        this.buckets = new Map();
    }
    allow(key) {
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
exports.RateLimiter = RateLimiter;
