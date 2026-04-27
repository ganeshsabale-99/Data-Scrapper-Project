# apps/analyzer-api/Dockerfile
# Optimized multi-stage build: pnpm + Turborepo + Prisma on Alpine
# Target: linux/amd64 | Node 20 Alpine
# Estimated final image size: ~350-400MB (down from ~1.4GB)

# ─── Stage 1: Builder ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /work

# Alpine needs libc6-compat for native Node.js binaries; bash for pnpm scripts
RUN apk add --no-cache libc6-compat bash

# Skip Puppeteer's Chromium download — saves ~300MB in the builder stage
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# ── Layer-cache friendly: copy manifests BEFORE source code ──────────
# If only source changes, Docker reuses the cached install layer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/analyzer-api/package.json  apps/analyzer-api/
COPY packages/db/package.json        packages/db/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json     packages/eslint-config/
COPY packages/ui/package.json               packages/ui/

# Install ALL deps (dev + prod) — needed for TypeScript compilation
# Pin to the version declared in packageManager field to avoid corepack surprises
RUN npm install -g pnpm@9 --quiet && \
    pnpm install --frozen-lockfile

# Copy full source AFTER install (preserves install cache when only src changes)
COPY . .

# Generate Prisma client BEFORE tsc so generated types are available to TypeScript
RUN pnpm --filter @repo/db exec prisma generate --schema=prisma/schema.prisma

# Build shared @repo/db package first (produces packages/db/dist/index.js)
RUN pnpm --filter @repo/db run build

# Build the API (tsc — outputs to apps/analyzer-api/dist/)
RUN pnpm --filter ./apps/analyzer-api run build

# ── Production prune ─────────────────────────────────────────────────
# pnpm deploy resolves ALL workspace symlinks (e.g. @repo/db) and copies ONLY
# production dependencies into /prod-app — no dev tools, no root node_modules.
# This is the single biggest size reduction lever in this Dockerfile.
RUN pnpm --filter analyzer-api deploy --prod /prod-app

# ── Re-generate Prisma client inside the deployed directory ──────────
# IMPORTANT: pnpm deploy creates a FRESH standalone node_modules.
# The .prisma/client/ generated files from the earlier `prisma generate`
# are NOT carried over — they only exist in the builder's workspace node_modules.
# We must regenerate them here so the runner image has the compiled client.
RUN cp -r /work/packages/db/prisma /prod-app/prisma && \
    bash -c '\
        PKG_DIR=$(ls /work/node_modules/.pnpm | grep "@prisma.client" | head -1) && \
        echo "Copying .prisma from pnpm store entry: $PKG_DIR" && \
        cp -r /work/node_modules/.pnpm/${PKG_DIR}/node_modules/.prisma \
              /prod-app/node_modules/.pnpm/${PKG_DIR}/node_modules/ \
    '

# ─── Stage 2: Runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Prevent Puppeteer from erroring on missing Chromium binary at startup
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create a non-root user before copying any files (security best practice)
# Create a non-root user before copying any files (security best practice)
# libc6-compat is required for Prisma's native engines to run on Alpine Node.js.
# Without it, Prisma results in a Segmentation Fault (Exit Code 139).
RUN apk add --no-cache libc6-compat && \
    addgroup -S app && adduser -S -G app app

# ── Copy only what the runtime needs ─────────────────────────────────
# /prod-app is a self-contained directory: package.json + node_modules + dist
# .prisma/client generated files are inside node_modules (re-generated after deploy)
# Prisma schema is in /prod-app/prisma (copied there during the re-generate step)
COPY --from=builder /prod-app/package.json  ./package.json
COPY --from=builder /prod-app/node_modules  ./node_modules
COPY --from=builder /prod-app/dist          ./dist
COPY --from=builder /prod-app/prisma        ./prisma

USER app
EXPOSE 3000

# Entry point — matches "start" script in package.json
CMD ["node", "dist/index.js"]
