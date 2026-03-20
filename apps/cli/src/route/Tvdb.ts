import type { UserConfig } from "@core/types";
import { getAppDataDir, getUserDataDir } from "@/utils/config";
import path from "path";
import type { Context, Hono } from "hono";
import { logger, logHttpReqOut, logHttpRespIn } from "../../lib/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import fs from "fs";
import { Mutex } from "es-toolkit";

const TVDB_DEFAULT_HOST = "https://api4.thetvdb.com/v4";

async function getUserConfig(): Promise<UserConfig | null> {
  try {
    const userDataDir = getUserDataDir();
    const configPath = path.join(userDataDir, "smm.json");
    const file = Bun.file(configPath);
    if (!(await file.exists())) return null;
    const content = await file.text();
    return JSON.parse(content) as UserConfig;
  } catch (error) {
    logger.error({ error }, "Tvdb: failed to read user config");
    return null;
  }
}

function tvdbTokenCacheFilePath(appDataDir: string) {
  return path.join(appDataDir, 'tvdb-token.txt');
}

/**
 * The content format for TVDB token cache file
 * The key is domain without scheme and port, such as "api4.thetvdb.com"
 */
interface TokenCacheFile {
  [domain: string]: string;
}

const tokenRwMutex = new Mutex();

async function getTokenFromCache(appDataDir: string, domain: string): Promise<string | null> {
  await tokenRwMutex.acquire();
  try {
    const tokenPath = tvdbTokenCacheFilePath(appDataDir);
    const file = fs.readFileSync(tokenPath, 'utf-8');
    const obj = JSON.parse(file) as TokenCacheFile;
    return obj[domain] ?? null;
  } catch (error) { 
    const message = error instanceof Error ? error.message : String(error);
    if(message.includes('ENOENT: no such file or directory')) {
      return null;
    }
    throw error;
  } finally {
    tokenRwMutex.release();
  }
  
}

async function saveTokenToCache(appDataDir: string, domain: string, token: string) {
  try {
    await tokenRwMutex.acquire();

    // IMPORTANT: do NOT reuse getTokenFromCache method, because it acquire lock internally.
    // Reusing getTokenFromCache will cause deadlock.
    const tokenPath = tvdbTokenCacheFilePath(appDataDir);

    if(await Bun.file(tokenPath).exists()) {

      const file = fs.readFileSync(tokenPath, 'utf-8');
      const obj = JSON.parse(file) as TokenCacheFile;
      obj[domain] = token;

      fs.writeFileSync(tokenPath, token);

    } else {

      logger.debug(`TVDB token cache file not found, create new one`);
      const obj: TokenCacheFile = {};
      obj[domain] = token;
      fs.writeFileSync(tokenPath, JSON.stringify(obj, null, 2));

    }

  } finally {
    tokenRwMutex.release();
  }
}

interface LoginResponse {
  data: {
    token: string;
  };
  status: string;
}

async function login(host: string, apiKey: string): Promise<LoginResponse> {
  const url = `${host}/login`;
  logHttpReqOut(url, 'POST', { apikey: `******${apiKey.slice(-10)}` });
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ apikey: apiKey }),
  });
  const obj = (await resp.json()) as unknown as LoginResponse;
  logHttpRespIn(url, resp.status, obj);
  return obj;
}

function createHeaders(resp: Response) {
  const headers: Record<string, string> = {
    'Via': "simple-media-manager"
  }

  // Forward response headers (excluding hop-by-hop headers).
  // If the remote proxy already added a `Via` header, append ours after it.
  const hopByHopHeaders = new Set([
    // RFC 9110 hop-by-hop headers
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    // Not useful/unsafe to forward
    "content-length",
  ]);

  resp.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if(lowerKey === 'content-encoding') return;
    if (lowerKey === "via") return;
    if (hopByHopHeaders.has(lowerKey)) return;
    headers[key] = value;
  });

  const viaFromResp = resp.headers.get("Via");
  if (viaFromResp) {
    headers["Via"] = `${headers["Via"]}, ${viaFromResp}`;
  }

  return headers;
}

const TVDB_PROXY_HOST = 'https://tmdb-mcp-server.imlc.me/api/tvdb';

async function forwardToTvdb(c: Context, _host: string, apiKey?: string) {
  
  /**
   * Indicating it used SMM provided TVDB proxy server.
   * which does NOT require token to login
   */
  const useTvdbProxy = _host === TVDB_PROXY_HOST;
  const host = _host.endsWith('/v4') ? _host : `${_host}/v4`;
  const incomingUrl = new URL(c.req.url);
  const tvdbApiPath = incomingUrl.pathname.replace('/api/tvdb', '');
  const upstreamUrl = `${host}${tvdbApiPath}${incomingUrl.search}`;

  let token: string | null = null;

  if(!useTvdbProxy) {

    if(apiKey === undefined) {
      logger.error(`Missing TVDB API Key for TVDB ${host}`);
      return c.json({
        error: 'Missing TVDB API Key',
      }, 400);
    }

    token = await getTokenFromCache(getAppDataDir(), new URL(host).host);
    if(token === null) {
      const loginResp = await login(host, apiKey);
      await saveTokenToCache(getAppDataDir(), new URL(host).host, loginResp.data.token);
      token = loginResp.data.token;
      logger.debug(`TVDB token cached: ******${token.slice(-10)}`);
    } else {
      logger.debug(`Use TVDB token from cache: ******${token.slice(-10)}`);
    }
  }

  const reqHeaders: Record<string, string> = {
    "Content-Type": c.req.header("content-type") ?? "application/json",
    Accept: c.req.header("accept") ?? "application/json",
  }

  if(!useTvdbProxy) {  
    if (!token) {
      return c.json({ error: "Failed to obtain TVDB auth token" }, 502);
    }
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  const method = c.req.method;
  const hasRequestBody = method !== "GET" && method !== "HEAD";
  const requestBody = hasRequestBody ? await c.req.arrayBuffer().catch(() => undefined) : undefined;

  logHttpReqOut(upstreamUrl, method, requestBody);
  const resp = await fetch(upstreamUrl, {
    method,
    headers: reqHeaders,
    body: requestBody,
  });

  const obj = await resp.json();

  logHttpRespIn(upstreamUrl, resp.status, obj);

  const respHeaders = createHeaders(resp);
  const respContentType = resp.headers.get("content-type") ?? "";

  if (respContentType.includes("application/json")) {
    return c.json(obj, resp.status as ContentfulStatusCode, respHeaders);
  }

  if (method === "HEAD") {
    return new Response(null, { status: resp.status, headers: respHeaders });
  }

  const buf = await resp.arrayBuffer();
  return new Response(buf, { status: resp.status, headers: respHeaders });

}

export function handleTvdb(app: Hono) {
  app.all("/api/tvdb/*", async (c) => {
    const userConfig = await getUserConfig();    

    if(userConfig !== null) {

      const hostFromUserConfig = userConfig?.tvdb?.host ?? '';
      const apiKeyFromUserConfig = userConfig?.tvdb?.apiKey ?? '';

      if(hostFromUserConfig !== '' && apiKeyFromUserConfig !== '') {
        return await forwardToTvdb(c, hostFromUserConfig, apiKeyFromUserConfig);
      }

    }

    return forwardToTvdb(c, TVDB_PROXY_HOST);
    
  });
}
