import http from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { setInterval } from 'timers';
import { randomUUID } from 'crypto';
import { z } from 'zod';

// Basic config
const PORT = parseInt(process.env.PORT || '8080', 10);
const WS_PATH = '/ws';
const ROOM_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MSG_BYTES = 64 * 1024; // 64KB per signaling frame

// Simple IP-based token bucket rate limiter
class RateLimiter {
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
const rateLimiter = new RateLimiter(30, 3); // up to ~30 ops burst, ~3 ops/sec sustained per IP

// Room store
type Room = {
  id: string;
  joinToken: string;
  host?: WebSocket;
  guest?: WebSocket;
  expiresAt: number;
};
const rooms = new Map<string, Room>();

// zod schemas for messages
const msgBase = z.object({ type: z.string() });
const createRoomMsg = msgBase.extend({ type: z.literal('create_room') });
const joinRoomMsg = msgBase.extend({ type: z.literal('join_room'), payload: z.object({ roomId: z.string(), token: z.string() }) });
const signalMsg = msgBase.extend({ type: z.literal('signal'), payload: z.object({ roomId: z.string(), data: z.any() }) });
const endRoomMsg = msgBase.extend({ type: z.literal('end_room'), payload: z.object({ roomId: z.string() }) });
const heartbeatMsg = msgBase.extend({ type: z.literal('heartbeat'), payload: z.object({ roomId: z.string() }) });

function ipFromReq(req: http.IncomingMessage): string {
  const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return xff || (req.socket.remoteAddress || 'unknown');
}

function safeSend(ws: WebSocket, obj: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function nowTs() { return Date.now(); }

// Create server and WS
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG_BYTES });

server.on('upgrade', (req: http.IncomingMessage, socket, head) => {
  if (!req.url) { socket.destroy(); return; }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== WS_PATH) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const ip = ipFromReq(req);
  let boundRoomId: string | null = null;
  let role: 'host' | 'guest' | null = null;
  // connection log
  console.log(JSON.stringify({ at: new Date().toISOString(), evt: 'ws_connection', ip }));

  ws.on('message', (data: RawData) => {
    if (!rateLimiter.allow(ip)) {
      safeSend(ws, { type: 'error', error: 'rate_limited' });
      ws.close(1011, 'rate_limited');
      return;
    }
    let text: string | null = null;
    if (typeof (data as any) === 'string') {
      text = data as unknown as string;
    } else if (data instanceof Buffer) {
      try { text = data.toString('utf8'); } catch { text = null; }
    } else {
      try { text = Buffer.from(data as ArrayBuffer).toString('utf8'); } catch { text = null; }
    }
    if (text == null) return;
    if (Buffer.byteLength(text, 'utf8') > MAX_MSG_BYTES) {
      safeSend(ws, { type: 'error', error: 'too_large' });
      return;
    }

    let json: unknown;
    try { json = JSON.parse(text); } catch {
      safeSend(ws, { type: 'error', error: 'invalid_json' });
      return;
    }

    if (createRoomMsg.safeParse(json).success) {
      // Host creating room
      const id = randomUUID().replace(/-/g, '').slice(0, 20);
      const token = randomUUID().replace(/-/g, '').slice(0, 24);
      const room: Room = { id, joinToken: token, host: ws, expiresAt: nowTs() + ROOM_TTL_MS };
      rooms.set(id, room);
      boundRoomId = id;
      role = 'host';
      console.log(JSON.stringify({ at: new Date().toISOString(), evt: 'room_created', ip, roomId: id, expiresAt: room.expiresAt }));
      safeSend(ws, { type: 'room_created', payload: { roomId: id, joinToken: token, expiresAt: room.expiresAt } });
      return;
    }

    const join = joinRoomMsg.safeParse(json);
    if (join.success) {
      const { roomId, token } = join.data.payload;
      const room = rooms.get(roomId);
      if (!room) { safeSend(ws, { type: 'error', error: 'no_such_room' }); return; }
      if (nowTs() > room.expiresAt) { rooms.delete(roomId); safeSend(ws, { type: 'error', error: 'expired' }); return; }
      if (!room.joinToken || token !== room.joinToken) { safeSend(ws, { type: 'error', error: 'bad_token' }); return; }
      if (room.guest) { safeSend(ws, { type: 'error', error: 'already_joined' }); return; }
      room.guest = ws;
      room.joinToken = ''; // one-time
      boundRoomId = roomId;
      role = 'guest';
      console.log(JSON.stringify({ at: new Date().toISOString(), evt: 'room_joined', ip, roomId }));
      safeSend(ws, { type: 'room_joined', payload: { roomId } });
      if (room.host) { safeSend(room.host, { type: 'guest_joined', payload: { roomId } }); }
      return;
    }

    const sig = signalMsg.safeParse(json);
    if (sig.success) {
      const { roomId, data: sdpOrIce } = sig.data.payload;
      const room = rooms.get(roomId);
      if (!room) { safeSend(ws, { type: 'error', error: 'no_such_room' }); return; }
      const target = ws === room.host ? room.guest : room.host;
      console.log(JSON.stringify({ at: new Date().toISOString(), evt: 'signal_relay', ip, roomId }));
      if (target) { safeSend(target, { type: 'signal', payload: { roomId, data: sdpOrIce } }); }
      return;
    }

    const end = endRoomMsg.safeParse(json);
    if (end.success) {
      const { roomId } = end.data.payload;
      const room = rooms.get(roomId);
      if (room) {
        console.log(JSON.stringify({ at: new Date().toISOString(), evt: 'room_end', ip, roomId }));
        if (room.host && room.host !== ws) safeSend(room.host, { type: 'ended', payload: { roomId } });
        if (room.guest && room.guest !== ws) safeSend(room.guest, { type: 'ended', payload: { roomId } });
        rooms.delete(roomId);
      }
      return;
    }

    const hb = heartbeatMsg.safeParse(json);
    if (hb.success) {
      const { roomId } = hb.data.payload;
      const room = rooms.get(roomId);
      if (room) {
        room.expiresAt = nowTs() + ROOM_TTL_MS; // extend during active session
      }
      return;
    }

    safeSend(ws, { type: 'error', error: 'unknown_type' });
  });

  ws.on('close', () => {
    if (!boundRoomId) return;
    const room = rooms.get(boundRoomId);
    if (!room) return;
    console.log(JSON.stringify({ at: new Date().toISOString(), evt: 'ws_close', ip, roomId: boundRoomId, role }));
    if (role === 'host') {
      if (room.guest) safeSend(room.guest, { type: 'ended', payload: { roomId: room.id } });
      rooms.delete(room.id);
    } else if (role === 'guest') {
      if (room.host) safeSend(room.host, { type: 'guest_left', payload: { roomId: room.id } });
      room.guest = undefined;
    }
  });
});

// Periodic cleanup
setInterval(() => {
  const t = nowTs();
  for (const [id, room] of rooms) {
    if (t > room.expiresAt) {
      console.log(JSON.stringify({ at: new Date().toISOString(), evt: 'room_expired', roomId: id }));
      if (room.host) safeSend(room.host, { type: 'expired', payload: { roomId: id } });
      if (room.guest) safeSend(room.guest, { type: 'expired', payload: { roomId: id } });
      rooms.delete(id);
    }
  }
}, 30 * 1000);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[signaling] listening on :${PORT}${WS_PATH}`);
});
