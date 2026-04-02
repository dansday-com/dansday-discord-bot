# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:25.8.1-alpine AS builder

WORKDIR /app

ENV NODE_OPTIONS=""

COPY package.json ./
RUN npm install --include=dev --legacy-peer-deps

COPY . .

RUN npm run build:otel
RUN npm run build

RUN mkdir -p utils \
	&& npx --yes esbuild@0.25.0 src/lib/utils/index.ts \
		--bundle --platform=node --format=esm --packages=external \
		--outfile=utils/index.js \
	&& npx --yes esbuild@0.25.0 src/lib/database.ts \
		--bundle --platform=node --format=esm --packages=external \
		--external:'./utils/index.js' \
		--outfile=database.js

RUN npx tsc -p tsconfig.bots.json || true

RUN npm prune --production

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM node:25.8.1-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/otel ./otel
COPY --from=builder /app/bots ./bots
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/database.js ./database.js
COPY --from=builder /app/src/lib/migrations ./src/lib/migrations
COPY --from=builder /app/src/lib/schema.sql ./src/lib/schema.sql
COPY --from=builder /app/src/lib/backend/bots/official-bot/locales ./bots/bots/official-bot/locales

EXPOSE 80

ENV HOST=0.0.0.0
ENV PORT=80
ENV NODE_ENV=production

CMD ["node", "--import", "./otel/console-instrumentation.js", "build/index.js"]
