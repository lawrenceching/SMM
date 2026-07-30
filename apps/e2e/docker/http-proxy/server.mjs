import { Server } from 'proxy-chain';

const port = Number.parseInt(process.env.PROXY_PORT || '8990', 10);
const host = process.env.PROXY_HOST || '0.0.0.0';

const server = new Server({
  port,
  host,
  verbose: false,
});

await server.listen();
console.log(`[e2e-http-proxy] listening on http://${host}:${port}`);
