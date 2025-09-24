import { z } from 'zod';
import { AnyInbound, CreateRoom, JoinRoom, Signal, EndRoom, Heartbeat } from './schemas';

export type SignalingEvents = {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: unknown) => void;
  onMessage?: (msg: z.infer<typeof AnyInbound>) => void;
  // Reconnect lifecycle (client-driven)
  onReconnectAttempt?: (attempt: number, delayMs: number) => void;
  onReconnectSuccess?: (attempt: number) => void;
  onReconnectGiveUp?: (attempts: number) => void;
};

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private events: SignalingEvents;
  private retryCount = 0;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private intentionalClose = false;

  constructor(url: string, events: SignalingEvents = {}) {
    this.url = url;
    this.events = events;
    // Defaults: quick retries initially, cap at 10s, total ~8 attempts
    this.baseDelayMs = 300;
    this.maxDelayMs = 10_000;
    this.maxRetries = 8;
  }

  private openWebSocket() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.retryCount = 0; // reset backoff
      this.events.onOpen?.();
      if (this.retryCount > 0) {
        this.events.onReconnectSuccess?.(this.retryCount);
      }
    };
    this.ws.onclose = (e) => {
      this.events.onClose?.(e.code, e.reason);
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };
    this.ws.onerror = (e) => {
      this.events.onError?.(e);
      // onerror does not necessarily close; rely on onclose to schedule reconnect
    };
    this.ws.onmessage = (e) => {
      try {
        const parsed = AnyInbound.parse(JSON.parse(e.data as string));
        this.events.onMessage?.(parsed);
      } catch (err) {
        this.events.onError?.(err);
      }
    };
  }

  private scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) {
      this.events.onReconnectGiveUp?.(this.retryCount);
      return;
    }
    this.retryCount += 1;
    const exp = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (this.retryCount - 1));
    const jitter = Math.floor(Math.random() * 250);
    const delay = exp + jitter;
    this.events.onReconnectAttempt?.(this.retryCount, delay);
    setTimeout(() => {
      if (this.intentionalClose) return; // stopped meanwhile
      this.openWebSocket();
    }, delay);
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.intentionalClose = false;
    this.openWebSocket();
  }

  send(obj: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('ws_not_open');
    this.ws.send(JSON.stringify(obj));
  }

  createRoom() {
    const msg = CreateRoom.parse({ type: 'create_room' });
    this.send(msg);
  }

  joinRoom(roomId: string, token: string) {
    const msg = JoinRoom.parse({ type: 'join_room', payload: { roomId, token } });
    this.send(msg);
  }

  signal(roomId: string, data: unknown) {
    const msg = Signal.parse({ type: 'signal', payload: { roomId, data } });
    this.send(msg);
  }

  heartbeat(roomId: string) {
    const msg = Heartbeat.parse({ type: 'heartbeat', payload: { roomId } });
    this.send(msg);
  }

  endRoom(roomId: string) {
    const msg = EndRoom.parse({ type: 'end_room', payload: { roomId } });
    this.send(msg);
  }

  close() {
    this.intentionalClose = true;
    this.ws?.close();
    this.ws = null;
  }
}

export function signalingUrlFromEnv(): string {
  const u = process.env.NEXT_PUBLIC_SIGNALING_URL;
  if (!u) {
    // default to local dev
    return 'ws://localhost:8080/ws';
  }
  return u;
}
