# Dockerfile for coturn (TURN server)
# Supports UDP on platforms that allow it (e.g., Fly.io, VPS). On Render, only TCP/TLS is available.

FROM alpine:3.20

RUN apk add --no-cache coturn bash ca-certificates

# Copy configuration (edit turnserver.conf as needed)
COPY turnserver.conf /etc/turnserver.conf

# Optional: copy TLS certs if you terminate TLS inside coturn
# COPY certs/fullchain.pem /etc/ssl/certs/fullchain.pem
# COPY certs/privkey.pem   /etc/ssl/private/privkey.pem

# Expose default TURN ports
EXPOSE 3478/udp 3478/tcp 5349/tcp

# Note: Many providers require UDP for full TURN functionality.
# If your platform lacks UDP, prefer turns: on 5349 (TCP/TLS), but expect reduced success on strict NATs.

CMD ["turnserver", "-c", "/etc/turnserver.conf", "-v"]
