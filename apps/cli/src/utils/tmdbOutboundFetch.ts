import * as http from 'node:http';
import * as https from 'node:https';
import { trustAllTmdbCertEnabled } from './tmdbTls';

const hopByHop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

/**
 * Bun's fetch uses its own TLS stack and often still fails on some Windows / custom-cert
 * hosts even with TRUST_ALL_TMDB_CERT and NODE_TLS_REJECT_UNAUTHORIZED=0.
 * Node's https.request(res rejectUnauthorized: false) honors the flag reliably.
 */
function fetchHttpsOrHttpViaNode(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const isHttps = url.protocol === 'https:';

  const headers: http.OutgoingHttpHeaders = {};
  request.headers.forEach((value, key) => {
    if (hopByHop.has(key.toLowerCase())) return;
    headers[key] = value;
  });

  const method = request.method.toUpperCase();
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
  const pathWithQuery = `${url.pathname}${url.search}`;

  return new Promise((resolve, reject) => {
    const onResponse = (res: http.IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const resHeaders = new Headers();
        for (const [key, val] of Object.entries(res.headers)) {
          if (val === undefined) continue;
          if (Array.isArray(val)) {
            for (const v of val) resHeaders.append(key, v);
          } else {
            resHeaders.append(key, val);
          }
        }
        resolve(
          new Response(buf, {
            status: res.statusCode ?? 502,
            statusText: res.statusMessage ?? '',
            headers: resHeaders,
          }),
        );
      });
    };

    const start = async () => {
      let body: Buffer | undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        body = Buffer.from(await request.arrayBuffer());
      }

      if (isHttps) {
        const req = https.request(
          {
            hostname: url.hostname,
            port,
            path: pathWithQuery,
            method: request.method,
            headers,
            rejectUnauthorized: false,
          },
          onResponse,
        );
        req.on('error', reject);
        if (body !== undefined && body.length > 0) req.write(body);
        req.end();
      } else {
        const req = http.request(
          {
            hostname: url.hostname,
            port,
            path: pathWithQuery,
            method: request.method,
            headers,
          },
          onResponse,
        );
        req.on('error', reject);
        if (body !== undefined && body.length > 0) req.write(body);
        req.end();
      }
    };

    void start().catch(reject);
  });
}

/** Outbound TMDB (proxy or API): uses Bun fetch unless TRUST_ALL_TMDB_CERT requests Node TLS bypass. */
export async function tmdbOutboundFetch(input: string | Request, init?: RequestInit): Promise<Response> {
  const request = typeof input === 'string' ? new Request(input, init) : input;
  if (!trustAllTmdbCertEnabled()) {
    return fetch(request);
  }
  return fetchHttpsOrHttpViaNode(request);
}
