# Optional image build for the Compose http-proxy service.
# Default docker-compose.yml uses oven/bun:1.3 + a bind mount instead, so
# developers are not blocked when Docker Hub is unreachable.
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./

ENV PROXY_HOST=0.0.0.0
ENV PROXY_PORT=8990
EXPOSE 8990

CMD ["node", "server.mjs"]
