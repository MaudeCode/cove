# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN bun run build

# Production stage - rootless nginx
FROM nginxinc/nginx-unprivileged:alpine-slim

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Use non-root user (nginx-unprivileged runs as uid 101)
USER nginx

# Expose unprivileged port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Labels
LABEL org.opencontainers.image.source="https://github.com/MaudeCode/cove"
LABEL org.opencontainers.image.description="A beautiful WebUI for OpenClaw"
LABEL org.opencontainers.image.licenses="MIT"
