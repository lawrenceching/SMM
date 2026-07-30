# Lightweight HTTP forward proxy for Docker e2e (Compose service http-proxy).
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./

ENV PROXY_HOST=0.0.0.0
ENV PROXY_PORT=8990
EXPOSE 8990

CMD ["node", "server.mjs"]
