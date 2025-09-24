import { describe, it, expect } from 'vitest';
import { AnyInbound } from './schemas';

describe('schemas: AnyInbound', () => {
  it('parses room_created', () => {
    const msg = { type: 'room_created', payload: { roomId: 'abc', joinToken: 'tok', expiresAt: Date.now() + 300000 } };
    const parsed = AnyInbound.parse(msg);
    expect(parsed.type).toBe('room_created');
  });

  it('parses signal', () => {
    const msg = { type: 'signal', payload: { roomId: 'abc', data: { sdp: { type: 'offer', sdp: 'v=0' } } } };
    const parsed = AnyInbound.parse(msg);
    expect(parsed.type).toBe('signal');
  });

  it('rejects invalid type', () => {
    const msg = { type: 'nope', payload: {} } as any;
    expect(() => AnyInbound.parse(msg)).toThrowError();
  });
});
