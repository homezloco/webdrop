"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ws_1 = __importDefault(require("ws"));
const node_http_1 = __importDefault(require("node:http"));
const signaling_1 = require("./signaling");
function randPort() {
    // Pick a high, likely-free port
    return 12000 + Math.floor(Math.random() * 20000);
}
async function nextJson(ws) {
    const raw = await once(ws, 'message');
    let text = null;
    if (typeof raw === 'string') {
        text = raw;
    }
    else if (Buffer.isBuffer(raw)) {
        text = raw.toString('utf8');
    }
    else if (raw && typeof raw.data !== 'undefined') {
        // Some environments provide { data: Buffer | string }
        const d = raw.data;
        if (typeof d === 'string')
            text = d;
        else if (Buffer.isBuffer(d))
            text = d.toString('utf8');
        else if (d instanceof ArrayBuffer)
            text = Buffer.from(d).toString('utf8');
    }
    else if (raw instanceof ArrayBuffer) {
        text = Buffer.from(raw).toString('utf8');
    }
    if (!text)
        throw new Error('unreadable_message_payload');
    return JSON.parse(text);
}
async function once(emitter, evt) {
    return new Promise((resolve, reject) => {
        const onData = (data) => {
            cleanup();
            resolve(data);
        };
        const onErr = (err) => {
            cleanup();
            reject(err);
        };
        const cleanup = () => {
            emitter.off(evt, onData);
            emitter.off('error', onErr);
        };
        emitter.on(evt, onData);
        emitter.on('error', onErr);
    });
}
async function waitForServerReady(port, timeoutMs = 10000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const tick = () => {
            const req = node_http_1.default.get({ host: '127.0.0.1', port, path: '/healthz', timeout: 1000 }, (res) => {
                if (res.statusCode === 200) {
                    res.resume();
                    resolve();
                }
                else {
                    res.resume();
                    retry();
                }
            });
            req.on('error', retry);
            req.end();
        };
        const retry = () => {
            if (Date.now() - start > timeoutMs) {
                reject(new Error('server_start_timeout'));
                return;
            }
            setTimeout(tick, 200);
        };
        tick();
    });
}
(0, vitest_1.describe)('signaling server integration', () => {
    let server = null;
    let port = randPort();
    (0, vitest_1.beforeAll)(async () => {
        server = (0, signaling_1.startSignaling)(port);
        await waitForServerReady(port);
    }, 20000);
    (0, vitest_1.afterAll)(async () => {
        await new Promise((resolve) => server === null || server === void 0 ? void 0 : server.close(() => resolve()));
    });
    (0, vitest_1.it)('should create a room, join it, relay a signal, and end the room', async () => {
        var _a, _b;
        const url = `ws://127.0.0.1:${port}/ws`;
        const host = new ws_1.default(url);
        const hostOpen = once(host, 'open');
        await hostOpen;
        host.send(JSON.stringify({ type: 'create_room' }));
        const createdData = await nextJson(host);
        (0, vitest_1.expect)(createdData.type).toBe('room_created');
        const { roomId, joinToken } = createdData.payload;
        (0, vitest_1.expect)(typeof roomId).toBe('string');
        (0, vitest_1.expect)(typeof joinToken).toBe('string');
        // guest joins
        const guest = new ws_1.default(url);
        await once(guest, 'open');
        guest.send(JSON.stringify({ type: 'join_room', payload: { roomId, token: joinToken } }));
        const joinedData = await nextJson(guest);
        (0, vitest_1.expect)(joinedData.type).toBe('room_joined');
        const notifyData = await nextJson(host);
        (0, vitest_1.expect)(notifyData.type).toBe('guest_joined');
        // send a dummy signal from host -> guest
        host.send(JSON.stringify({ type: 'signal', payload: { roomId, data: { hello: 'world' } } }));
        const relayedData = await nextJson(guest);
        (0, vitest_1.expect)(relayedData.type).toBe('signal');
        (0, vitest_1.expect)((_b = (_a = relayedData.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.hello).toBe('world');
        // end room from guest
        guest.send(JSON.stringify({ type: 'end_room', payload: { roomId } }));
        const endedData = await nextJson(host);
        (0, vitest_1.expect)(endedData.type).toBe('ended');
        host.close();
        guest.close();
    }, 25000);
});
