# WebDrop Deployment Guide

This document explains how to deploy:
- Next.js web app (Vercel)
- Signaling server (Fly.io using Docker)
- TURN configuration
- Blue/green and rollback flow

## 1) Repository Layout
- Web app: `src/`
- Signaling server: `server/signaling.ts`
- Dockerfile (signaling): `server/Dockerfile`
- Build outputs for signaling: `server-dist/`

## 2) Environment Variables
- `NEXT_PUBLIC_SIGNALING_URL` — public WSS endpoint of your signaling server, e.g. `wss://signal.webdrop.yourdomain/ws`
- `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` — optional
- TURN (optional, recommended):
  - `TURN_URL` — `turn:turn.example.com:3478`
  - `TURN_USERNAME`
  - `TURN_PASSWORD`

Note: client picks up NEXT_PUBLIC_* variables at build time. For server-side (Node), use non-NEXT_PUBLIC envs.

## 3) Deploy Next.js App (Vercel)
1. Push repo to GitHub.
2. Create Vercel project → import your repo.
3. In Project Settings → Environment Variables, set:
   - `NEXT_PUBLIC_SIGNALING_URL` → your public WSS URL (after signaling deployment)
   - Optional: `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_PASSWORD` if you want client-side awareness
   - Optional: `NEXT_PUBLIC_SENTRY_DSN`
4. Deploy. Vercel preview links allow testing; promote to production when ready.

## 4) Deploy Signaling Server (Fly.io)
This example uses the included Dockerfile.

1. Install Fly.io CLI and log in.
2. Build and push container image (or configure Fly to build from repo):
   ```bash
   cd webdrop
   docker build -t webdrop-signaling:latest -f server/Dockerfile .
   # push to your registry, or use `fly launch` to let Fly build
   ```
3. Create the Fly app (e.g., `webdrop-signal-green`) and configure env:
   - `PORT=8080`
   - `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` if available
4. Expose HTTPS, configure a custom domain (e.g., `signal.webdrop.yourdomain`).
5. Verify health: `https://signal.webdrop.yourdomain/healthz`
6. WebSocket endpoint will be `wss://signal.webdrop.yourdomain/ws`

## 5) Blue/Green Strategy & Rollback
- Maintain two Fly apps: `webdrop-signal-blue` and `webdrop-signal-green`.
- DNS or reverse proxy points `signal.webdrop.yourdomain` to one of them.
- Deploy new version to the inactive one; validate with health checks.
- Switch DNS (or proxy) to point to the new version.
- Rollback: point DNS back to the previous one.

For the Next app, Vercel supports instant rollbacks via the dashboard.

## 6) TURN Provider
- Recommended for strict NATs; improves connectivity where STUN-only fails.
- Options:
  - Managed TURN providers (e.g., Twilio ICE, Xirsys, etc.)
  - Self-hosted `coturn` behind TLS
- Provide credentials to the client via env:
  - `TURN_URL=turn:turn.example.com:3478`
  - `TURN_USERNAME=...`
  - `TURN_PASSWORD=...`

## 7) Observability
- Optional Sentry (front-end only by default here). Set `SENTRY_DSN` to enable.
- Add container logs inspection on Fly for signaling lifecycle.

## 8) Security
- This design never sends file bytes to the server; signaling only.
- Rate limiting and message size caps included.
- Use HTTPS and WSS in production.
- Keep tokens/timeouts short (5 minutes by default).

## 9) Post-Deploy Checklist
- Verify `/healthz` and WebSocket upgrade on signaling.
- Validate QR flow and at least one file transfer across mobile + desktop.
- Test strict NAT scenario; verify TURN fallback (if configured).
- Enable Sentry DSN if desired and confirm events flow.

## 10) Troubleshooting
- If connections stall, check:
  - CSP `connect-src` (must allow `wss:`)
  - TURN credentials and reachability
  - Corporate networks blocking WebSockets (use Manual signaling fallback)
- If performance lags on large files, consider chunk sizing and backpressure tuning (client already respects DataChannel backpressure behavior).

---

## Netlify (Frontend) + External Signaling (Render/VM)

Netlify is excellent for hosting the Next.js frontend. Host the signaling server on a provider that supports WebSockets (e.g., Render) and set the frontend to point at it.

### Netlify Settings (Frontend)
- Build command: `npm ci && npm run build`
- Publish directory: `.next`
- Environment variables:
  - `NEXT_PUBLIC_SIGNALING_URL=wss://<signal-host>/ws`
  - Optional: `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_PASSWORD`
  - Optional: `NEXT_PUBLIC_SENTRY_DSN`

Notes:
- Ensure the signaling URL is `wss://` to avoid mixed content on HTTPS sites.
- CSP in `next.config.ts` already allows `ws:` and `wss:`; if you tighten it, include your signaling host in `connect-src`.

### Signaling on Render (or other WS-friendly host)
- Create a Web Service with WebSocket support enabled.
- Node:
  - Build: `npm ci && npm run build:signaling`
  - Start: `node server-dist/signaling.js`
- Docker: `server/Dockerfile`
- Env: `PORT=8080`
- Health: `/healthz`

