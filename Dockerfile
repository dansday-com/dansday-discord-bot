FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache tzdata

COPY package.json ./

RUN sh -c 'unset NODE_OPTIONS; npm install --include=dev'

COPY . .

RUN sh -c 'unset NODE_OPTIONS; npx @tailwindcss/cli -i frontend/input.css -o frontend/index.css --minify'

RUN sh -c 'unset NODE_OPTIONS; npm prune --omit=dev'

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:80/health', r => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "index.js"]
