# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN bun run build

# Production stage - Bun server with canvas proxy
FROM oven/bun:1-alpine

WORKDIR /app

# Copy only what's needed for production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/package.json ./

# Install only production deps (none needed for server.ts, but keep for future)
# RUN bun install --production --frozen-lockfile

# Use non-root user
RUN adduser -D -u 1001 cove
USER cove

# Expose port
EXPOSE 8080

# Environment defaults (can be overridden)
ENV PORT=8080
ENV GATEWAY_HOST=127.0.0.1
ENV GATEWAY_PORT=18789

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the server
CMD ["bun", "run", "server.ts"]

# Labels
LABEL org.opencontainers.image.source="https://github.com/MaudeCode/cove"
LABEL org.opencontainers.image.description="A beautiful WebUI for OpenClaw"
LABEL org.opencontainers.image.licenses="MIT"
