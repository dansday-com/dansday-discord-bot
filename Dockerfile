# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:25.8.1-alpine AS builder

WORKDIR /app

ENV NODE_OPTIONS=""

COPY package.json ./
RUN npm install --include=dev --legacy-peer-deps

COPY . .
RUN npm run build:otel
RUN npm run build
RUN npx tsc -p tsconfig.bots.json

RUN npm prune --production

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM node:25.8.1-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/otel ./otel
COPY --from=builder /app/build-bots ./build-bots
COPY --from=builder /app/src/lib/server/locales ./src/lib/server/locales
COPY --from=builder /app/src/lib/server/schema.sql ./src/lib/server/schema.sql

EXPOSE 80

ENV HOST=0.0.0.0
ENV PORT=80
ENV NODE_ENV=production

CMD ["node", "--import", "./otel/console-instrumentation.js", "build/index.js"]
