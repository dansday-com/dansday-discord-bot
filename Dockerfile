FROM node:25.8.1-slim AS builder

WORKDIR /app

ENV NODE_OPTIONS=""

RUN apt-get update && apt-get install -y --no-install-recommends \
	python3 make g++ libtool automake autoconf pkg-config libopus-dev ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

RUN npm run build

RUN npx tsc -p tsconfig.bots.json || true

RUN npm prune --production

FROM node:25.8.1-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl ffmpeg libopus0 ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=builder /app .

EXPOSE 80

ENV HOST=0.0.0.0
ENV PORT=80
ENV NODE_ENV=production

CMD ["node", "build/index.js"]
