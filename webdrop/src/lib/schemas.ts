import { z } from 'zod';

export const CreateRoom = z.object({ type: z.literal('create_room') });
export type CreateRoom = z.infer<typeof CreateRoom>;

export const RoomCreated = z.object({
  type: z.literal('room_created'),
  payload: z.object({ roomId: z.string(), joinToken: z.string(), expiresAt: z.number() }),
});
export type RoomCreated = z.infer<typeof RoomCreated>;

export const JoinRoom = z.object({
  type: z.literal('join_room'),
  payload: z.object({ roomId: z.string(), token: z.string() }),
});
export type JoinRoom = z.infer<typeof JoinRoom>;

export const RoomJoined = z.object({
  type: z.literal('room_joined'),
  payload: z.object({ roomId: z.string() }),
});
export type RoomJoined = z.infer<typeof RoomJoined>;

export const GuestJoined = z.object({
  type: z.literal('guest_joined'),
  payload: z.object({ roomId: z.string() }),
});
export type GuestJoined = z.infer<typeof GuestJoined>;

export const Signal = z.object({
  type: z.literal('signal'),
  payload: z.object({ roomId: z.string(), data: z.unknown() }),
});
export type Signal = z.infer<typeof Signal>;

export const EndRoom = z.object({
  type: z.literal('end_room'),
  payload: z.object({ roomId: z.string() }),
});
export type EndRoom = z.infer<typeof EndRoom>;

export const Heartbeat = z.object({
  type: z.literal('heartbeat'),
  payload: z.object({ roomId: z.string() }),
});
export type Heartbeat = z.infer<typeof Heartbeat>;

export const Ended = z.object({
  type: z.literal('ended'),
  payload: z.object({ roomId: z.string() }),
});
export type Ended = z.infer<typeof Ended>;

export const Expired = z.object({
  type: z.literal('expired'),
  payload: z.object({ roomId: z.string() }),
});
export type Expired = z.infer<typeof Expired>;

export const ErrorMsg = z.object({ type: z.literal('error'), error: z.string() });
export type ErrorMsg = z.infer<typeof ErrorMsg>;

export const AnyInbound = z.union([
  RoomCreated,
  RoomJoined,
  GuestJoined,
  Signal,
  Ended,
  Expired,
  ErrorMsg,
]);
export type AnyInbound = z.infer<typeof AnyInbound>;
