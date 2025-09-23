import { z } from 'zod';
import { AnyInbound, CreateRoom, JoinRoom, Signal, EndRoom, Heartbeat } from './schemas';

export type SignalingEvents = {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: unknown) => void;
  onMessage?: (msg: z.infer<typeof AnyInbound>) => void;
};

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private events: SignalingEvents;

  constructor(url: string, events: SignalingEvents = {}) {
    this.url = url;
    this.events = events;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => this.events.onOpen?.();
    this.ws.onclose = (e) => this.events.onClose?.(e.code, e.reason);
    this.ws.onerror = (e) => this.events.onError?.(e);
    this.ws.onmessage = (e) => {
      try {
        const parsed = AnyInbound.parse(JSON.parse(e.data as string));
        this.events.onMessage?.(parsed);
      } catch (err) {
        this.events.onError?.(err);
      }
    };
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
