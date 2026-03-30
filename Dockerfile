# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

ENV NODE_OPTIONS=""

COPY package.json package-lock.json ./
RUN npm install --include=dev

COPY . .
RUN npm run build
RUN npm run build:otel

RUN npm prune --production

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache tzdata curl

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/otel ./otel
COPY --from=builder /app/src/lib/server/bots ./src/lib/server/bots
COPY --from=builder /app/src/lib/server/locales ./src/lib/server/locales
COPY --from=builder /app/src/lib/server/schema.sql ./src/lib/server/schema.sql

EXPOSE 3001

ENV HOST=0.0.0.0
ENV PORT=3001
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "--import", "./otel/console-instrumentation.js", "build/index.js"]
