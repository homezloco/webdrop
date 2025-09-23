"use client";

export default function TurnNotice() {
  const hasTurn = Boolean(
    (process.env.NEXT_PUBLIC_TURN_URL || process.env.TURN_URL) &&
    (process.env.NEXT_PUBLIC_TURN_USERNAME || process.env.TURN_USERNAME) &&
    (process.env.NEXT_PUBLIC_TURN_PASSWORD || process.env.TURN_PASSWORD)
  );

  if (hasTurn) return null;

  return (
    <div className="text-xs p-3 rounded border bg-yellow-50 text-yellow-900">
      TURN is not configured. Peer-to-peer via STUN will be attempted, but strict networks may block direct connections.
      For best reliability, set TURN_URL, TURN_USERNAME, and TURN_PASSWORD in your environment.
    </div>
  );
}
