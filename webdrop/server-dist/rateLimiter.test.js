"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const rateLimiter_1 = require("./rateLimiter");
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
(0, vitest_1.describe)('RateLimiter', () => {
    (0, vitest_1.it)('allows up to capacity instantly then throttles', () => {
        const rl = new rateLimiter_1.RateLimiter(3, 1); // capacity 3, refill 1 token/sec
        const key = 'ip1';
        (0, vitest_1.expect)(rl.allow(key)).toBe(true);
        (0, vitest_1.expect)(rl.allow(key)).toBe(true);
        (0, vitest_1.expect)(rl.allow(key)).toBe(true);
        // 4th should be blocked
        (0, vitest_1.expect)(rl.allow(key)).toBe(false);
    });
    (0, vitest_1.it)('refills over time', async () => {
        const rl = new rateLimiter_1.RateLimiter(2, 2); // 2 tokens/sec
        const key = 'ip2';
        (0, vitest_1.expect)(rl.allow(key)).toBe(true);
        (0, vitest_1.expect)(rl.allow(key)).toBe(true);
        (0, vitest_1.expect)(rl.allow(key)).toBe(false);
        await sleep(600); // ~0.6 sec -> ~1 token available
        // Should allow one
        (0, vitest_1.expect)(rl.allow(key)).toBe(true);
    });
});
