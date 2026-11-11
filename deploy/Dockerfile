# beauty production image: SvelteKit adapter-node build on Node 26 (Temporal is built in), non-root.
# Build from the repo root: docker build -f deploy/Dockerfile -t beauty-app .
# Stage 1 "build": all dependencies + vite build. Stage 2 "deps": production dependencies only.
# Stage 3 "run": build/, migrations/, prod node_modules, package.json. Migrations run at start (hooks.server.ts).
# Stages 1 and 2 run on the BUILD platform: esbuild (Go) crashes under QEMU when the Mac builds linux/amd64, and
# their output is plain JS (no production dependency has a native addon or an install script). Only "run" is amd64.
FROM --platform=$BUILDPLATFORM node:26.11.1-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx svelte-kit sync && npx vite build

FROM --platform=$BUILDPLATFORM node:26.11.1-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

FROM node:26.11.1-slim AS run
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node package.json ./
COPY --chown=node:node migrations ./migrations
USER node
EXPOSE 3000
# slim has no curl: Node's fetch checks /health (200 only when the database answers).
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "build"]
