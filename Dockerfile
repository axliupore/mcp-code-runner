FROM node:lts-alpine AS builder

WORKDIR /app

COPY . .

RUN npm install --ignore-scripts

RUN npm run build

FROM node:lts-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package*.json ./

RUN npm install --production --ignore-scripts

RUN adduser -D mcpuser
USER mcpuser

CMD ["node", "./dist/index.js"]