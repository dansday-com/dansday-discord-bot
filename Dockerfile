# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:25.8.1-alpine AS builder

WORKDIR /app

ENV NODE_OPTIONS=""

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

RUN npm run build

RUN npx tsc -p tsconfig.bots.json || true

RUN npm prune --production

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM node:25.8.1-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app .

EXPOSE 80

ENV HOST=0.0.0.0
ENV PORT=80
ENV NODE_ENV=production

CMD ["node", "--import", "./otel/console-instrumentation.js", "build/index.js"]
