import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import http from 'node:http';
import { startSignaling } from './signaling';

function randPort(): number {
  // Pick a high, likely-free port
  return 12000 + Math.floor(Math.random() * 20000);
}

async function nextJson(ws: WebSocket): Promise<any> {
  const raw = await once<any>(ws, 'message');
  let text: string | null = null;
  if (typeof raw === 'string') {
    text = raw;
  } else if (Buffer.isBuffer(raw)) {
    text = raw.toString('utf8');
  } else if (raw && typeof raw.data !== 'undefined') {
    // Some environments provide { data: Buffer | string }
    const d = (raw as any).data;
    if (typeof d === 'string') text = d;
    else if (Buffer.isBuffer(d)) text = d.toString('utf8');
    else if (d instanceof ArrayBuffer) text = Buffer.from(d).toString('utf8');
  } else if (raw instanceof ArrayBuffer) {
    text = Buffer.from(raw).toString('utf8');
  }
  if (!text) throw new Error('unreadable_message_payload');
  return JSON.parse(text);
}

async function once<T = unknown>(emitter: any, evt: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const onData = (data: any) => {
      cleanup();
      resolve(data as T);
    };
    const onErr = (err: any) => {
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

async function waitForServerReady(port: number, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/healthz', timeout: 1000 }, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else {
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

describe('signaling server integration', () => {
  let server: http.Server | null = null;
  let port = randPort();

  beforeAll(async () => {
    server = startSignaling(port);
    await waitForServerReady(port);
  }, 20000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('should create a room, join it, relay a signal, and end the room', async () => {
    const url = `ws://127.0.0.1:${port}/ws`;
    const host = new WebSocket(url);
    const hostOpen = once(host, 'open');
    await hostOpen;

    host.send(JSON.stringify({ type: 'create_room' }));
    const createdData = await nextJson(host);
    expect(createdData.type).toBe('room_created');
    const { roomId, joinToken } = createdData.payload;
    expect(typeof roomId).toBe('string');
    expect(typeof joinToken).toBe('string');

    // guest joins
    const guest = new WebSocket(url);
    await once(guest, 'open');
    guest.send(JSON.stringify({ type: 'join_room', payload: { roomId, token: joinToken } }));

    const joinedData = await nextJson(guest);
    expect(joinedData.type).toBe('room_joined');

    const notifyData = await nextJson(host);
    expect(notifyData.type).toBe('guest_joined');

    // send a dummy signal from host -> guest
    host.send(JSON.stringify({ type: 'signal', payload: { roomId, data: { hello: 'world' } } }));
    const relayedData = await nextJson(guest);
    expect(relayedData.type).toBe('signal');
    expect(relayedData.payload?.data?.hello).toBe('world');

    // end room from guest
    guest.send(JSON.stringify({ type: 'end_room', payload: { roomId } }));
    const endedData = await nextJson(host);
    expect(endedData.type).toBe('ended');

    host.close();
    guest.close();
  }, 25000);
});
