# syntax=docker/dockerfile:1

# --- Build stage: compile signaling TypeScript to JS ---
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (include dev deps for tsc)
COPY package.json package-lock.json* .npmrc* ./
RUN npm ci || npm install --no-audit --no-fund

# Copy source needed to build signaling
COPY tsconfig.json ./
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/ ./server/

# Build signaling to server-dist/
RUN npm run build:signaling

# --- Runtime stage: minimal image running compiled JS ---
FROM node:20-alpine AS runtime
WORKDIR /app

# Only production deps
COPY package.json package-lock.json* .npmrc* ./
RUN npm ci --omit=dev || npm install --omit=dev --no-audit --no-fund

# Copy compiled signaling
COPY --from=build /app/server-dist ./server-dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Healthcheck (optional; container platforms may use this)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "server-dist/signaling.js"]
