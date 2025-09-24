"use client";

export default function TurnNotice() {
  const hasTurn = Boolean(
    (process.env.NEXT_PUBLIC_TURN_URL || process.env.TURN_URL) &&
    (process.env.NEXT_PUBLIC_TURN_USERNAME || process.env.TURN_USERNAME) &&
    (process.env.NEXT_PUBLIC_TURN_PASSWORD || process.env.TURN_PASSWORD)
  );

  if (hasTurn) return null;

  return (
    <div className="text-xs p-3 rounded border bg-yellow-50 text-yellow-900 space-y-2">
      <p>
        TURN is not configured. We will attempt P2P via STUN, but strict networks may block direct connections.
        For best reliability, configure a TURN server.
      </p>
      <div className="flex flex-wrap gap-2">
        <code className="px-2 py-1 rounded bg-yellow-100 border">NEXT_PUBLIC_TURN_URL</code>
        <code className="px-2 py-1 rounded bg-yellow-100 border">NEXT_PUBLIC_TURN_USERNAME</code>
        <code className="px-2 py-1 rounded bg-yellow-100 border">NEXT_PUBLIC_TURN_PASSWORD</code>
      </div>
      <div className="flex gap-2">
        <button
          className="px-2 py-1 rounded border hover:bg-yellow-100"
          onClick={() => navigator.clipboard?.writeText(
            [
              '# Example (production):',
              'NEXT_PUBLIC_TURN_URL=turns://turn.yourdomain.com:5349',
              'NEXT_PUBLIC_TURN_USERNAME=your-user',
              'NEXT_PUBLIC_TURN_PASSWORD=your-pass',
            ].join('\n')
          )}
          aria-label="Copy TURN env example"
        >Copy env example</button>
      </div>
    </div>
  );
}
