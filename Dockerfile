FROM node:25.8.1-slim AS builder

WORKDIR /app

ENV NODE_OPTIONS=""

RUN apt-get update && apt-get install -y --no-install-recommends \
	python3 make g++ libtool automake autoconf pkg-config libopus-dev ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

RUN npx tsc -p tsconfig.bots.json || true

FROM builder AS bots-builder

RUN npm prune --production

FROM builder AS web-builder

RUN npm run build

RUN npm prune --production

FROM node:25.8.1-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl ffmpeg libopus0 ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

FROM runtime AS bots

COPY --from=bots-builder /app .

CMD ["node", "--import", "./otel/console-instrumentation.js", "bots/backend/bots/runner.js"]

FROM runtime AS web

COPY --from=web-builder /app .

EXPOSE 80

ENV HOST=0.0.0.0
ENV PORT=80

CMD ["node", "--import", "./otel/console-instrumentation.js", "build/index.js"]
