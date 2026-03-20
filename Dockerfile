FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache tzdata

COPY package.json ./

RUN sh -c 'unset NODE_OPTIONS; npm install --include=dev'

COPY . .

RUN sh -c 'unset NODE_OPTIONS; npx @tailwindcss/cli -i frontend/input.css -o frontend/index.css --minify'

RUN npm prune --omit=dev

EXPOSE 80

CMD ["node", "index.js"]
