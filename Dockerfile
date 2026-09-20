# iris runtime image
# Builds the frontend and packages all core services into a single image.
# ~/.iris is always mounted as a volume — never baked in.
#
# Build:  docker build -t iris .
# Run:    docker compose up   (see docker-compose.yml)

# ── Stage 1: build Vite dashboard ────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/apps/dashboard
COPY apps/dashboard/package*.json ./
RUN npm ci
COPY apps/dashboard/ ./
COPY lib/ /app/lib/
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

# System deps (git for iris-github, curl for health checks, build tools for node-pty)
RUN apk add --no-cache git curl bash python3 make g++

WORKDIR /app

# Install root deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Drop the local dashboard dist if any — use the clean build from stage 1
RUN rm -rf apps/dashboard/dist
COPY --from=frontend-builder /app/apps/dashboard/dist ./apps/dashboard/dist

# Build and install iris-cli (makes `iris` command globally available)
WORKDIR /app/iris-cli
RUN npm ci && npm run build && npm link

# Return to app root
WORKDIR /app

# ~/.iris is always a mounted volume — the image never contains secrets.
# On first start the app bootstraps the directory if it doesn't exist.
VOLUME ["/root/.iris"]

# Exposed ports
# 4319 — dashboard
# 5010 — iris-lead
# 18889 — RT message bus
# 4096 — code engine
# 5020 — MCP server (optional)
# 3333 — Vibe IDE
# 3334 — Vibe watch server
EXPOSE 4319 5010 18889 4096 5020 3333 3334

# Start all core services via the existing restart script
CMD ["bash", "scripts/restart-all-from-repo.sh"]
