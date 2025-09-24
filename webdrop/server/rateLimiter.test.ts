import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rateLimiter';

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

describe('RateLimiter', () => {
  it('allows up to capacity instantly then throttles', () => {
    const rl = new RateLimiter(3, 1); // capacity 3, refill 1 token/sec
    const key = 'ip1';
    expect(rl.allow(key)).toBe(true);
    expect(rl.allow(key)).toBe(true);
    expect(rl.allow(key)).toBe(true);
    // 4th should be blocked
    expect(rl.allow(key)).toBe(false);
  });

  it('refills over time', async () => {
    const rl = new RateLimiter(2, 2); // 2 tokens/sec
    const key = 'ip2';
    expect(rl.allow(key)).toBe(true);
    expect(rl.allow(key)).toBe(true);
    expect(rl.allow(key)).toBe(false);
    await sleep(600); // ~0.6 sec -> ~1 token available
    // Should allow one
    expect(rl.allow(key)).toBe(true);
  });
});
