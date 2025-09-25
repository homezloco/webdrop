# WebDrop — P2P Beam Between Any Two Browsers

Open the site on two devices → scan a QR → drag anything → it beams device-to-device via WebRTC. No account. No server-side file storage.

## Stack
- Next.js + TypeScript (strict)
- WebRTC RTCDataChannel for file transfer (encrypted)
- WebSocket signaling server (`ws`) with ephemeral 5‑minute rooms
- Optional TURN fallback (env-configurable)
- Optional Sentry for observability

## Quickstart (Local)
1) Install dependencies
```bash
# Windows (CMD/PowerShell)
cd webdrop
npm i ws zod nanoid react-qr-code @sentry/nextjs
npm i -D concurrently ts-node @types/ws

# WSL
cd webdrop
npm i ws zod nanoid react-qr-code @sentry/nextjs
npm i -D concurrently ts-node @types/ws
```

2) Configure environment
```bash
cp .env.local.example .env.local
# Optionally fill TURN_*, SENTRY_DSN
```

3) Run
```bash
npm run dev
# Next.js: http://localhost:3000
# Signaling: ws://localhost:8080/ws  (health: http://localhost:8080/healthz)
```

4) Test
- Device A: open `http://localhost:3000` → Send
- Device B: scan QR (or open link) → Receive
- Drag files after “connected”; watch progress and save on receiver.

## Production Build & Start
```bash
npm run build
npm start
# Next serves built app; signaling runs from compiled JS in server-dist/
```

## Environment Variables
- `NEXT_PUBLIC_SIGNALING_URL` default `ws://localhost:8080/ws`
- `STUN_URLS` comma-separated STUN servers (defaults to Google STUN)
- `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` optional
- `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` optional
- `PORT` signaling server port (default 8080)

## Security
- No file bytes hit the server; only signaling (SDP/ICE)
- One-time join token; rooms auto-expire (5 minutes)
- IP rate limiting and message size caps in signaling server
- CSP, X-Frame-Options, etc. configured in `next.config.ts`

## Manual Signaling Fallback (No-WS Networks)
- Click “Advanced” on Send/Receive pages to reveal copy/paste SDP panel.
- Use only when normal QR/link flow fails.

## TURN Guidance
- For strict NATs, configure TURN to improve connectivity:
```
TURN_URL=turn:turn.example.com:3478
TURN_USERNAME=your-user
TURN_PASSWORD=your-pass
```

## Deployment (Blue/Green)
- Next.js app → Vercel (or similar) with preview branches and instant rollback.
- Signaling server → Fly.io/Node host with WSS (TLS). Health endpoint `/healthz`.
- Blue/green: run old and new signaling deployments, switch traffic via hostname.
- Feature flags can be added later to gate new flows.

## Observability
- Sentry initialization is optional; disabled unless DSN is set.
- Add logs for connection lifecycle in `server/signaling.ts` as needed.

## Notes
- DataChannel is encrypted; server never stores file data.
- Use TURN where reliability is critical.
