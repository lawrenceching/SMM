import type { UserConfig } from "@core/types";
import { getUserDataDir } from "@/utils/config";
import path from "path";
import type { Hono } from "hono";
import { logger } from "../../lib/logger";

const TVDB_DEFAULT_HOST = "https://api4.thetvdb.com/v4";
const TOKEN_EXPIRY_BUFFER_MS = 60 * 60 * 1000; // refresh 1h before expiry
const TOKEN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

async function getTvdbConfig(): Promise<{
  host: string;
  apiKey: string | undefined;
  error?: string;
}> {
  const userConfig = await getUserConfig();
  if (!userConfig) {
    return { host: "", apiKey: undefined, error: "User config not found. Please configure TVDB settings." };
  }
  const tvdb = userConfig.tvdb;
  const host = (tvdb?.host || TVDB_DEFAULT_HOST).replace(/\/+$/, "");
  const apiKey = tvdb?.apiKey;
  if (!apiKey || !apiKey.trim()) {
    return { host: "", apiKey: undefined, error: "TVDB API key is not configured. Please set your API key in settings." };
  }
  return { host, apiKey };
}

let cachedToken: string | null = null;
let tokenExpiryAt = 0;

async function getToken(host: string, apiKey: string): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiryAt - TOKEN_EXPIRY_BUFFER_MS) {
    return cachedToken;
  }
  const url = `${host}/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ apikey: apiKey }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn({ status: res.status, text }, "Tvdb login failed");
      return null;
    }
    const json = (await res.json()) as { data?: { token?: string } };
    const token = json?.data?.token;
    if (!token) return null;
    cachedToken = token;
    tokenExpiryAt = Date.now() + TOKEN_VALIDITY_MS;
    return token;
  } catch (error) {
    logger.error({ error }, "Tvdb login request error");
    return null;
  }
}

async function tvdbFetch(host: string, path: string, token: string): Promise<{ data: unknown; error?: string }> {
  const url = `${host}${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (!res.ok) {
      return { data: null, error: `TVDB API error: ${res.status} ${res.statusText}. ${text}` };
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { data: null, error: "Invalid JSON response from TVDB" };
    }
    const obj = data as { data?: unknown; status?: string };
    return { data: obj?.data ?? data };
  } catch (error) {
    logger.error({ error, url }, "Tvdb fetch error");
    return { data: null, error: `Failed to fetch from TVDB: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// TVDB search result shape (from v4 API)
interface TvdbSearchResultItem {
  id?: string;
  tvdb_id?: string;
  name?: string;
  title?: string;
  overview?: string;
  overview_translated?: string;
  image_url?: string;
  poster?: string;
  first_air_time?: string;
  year?: string;
  type?: string;
  [key: string]: unknown;
}

// Normalize to TMDB-like shape for UI compatibility
function mapTvdbSearchItemToTmdbLike(item: TvdbSearchResultItem): { id: number; name?: string; title?: string; overview?: string; poster_path?: string | null; first_air_date?: string; release_date?: string; vote_average?: number; media_type?: "tv" | "movie" } {
  const id = parseInt(item.id || item.tvdb_id || "0", 10) || 0;
  const isSeries = item.type === "series" || !!item.name;
  const name = item.name ?? item.title;
  const title = item.title ?? item.name;
  const overview = item.overview ?? (Array.isArray(item.overview_translated) ? undefined : (item.overview_translated as string));
  const poster = item.image_url || item.poster || null;
  const date = item.first_air_time || item.year || "";
  return {
    id,
    ...(isSeries ? { name, first_air_date: date, media_type: "tv" as const } : { title, release_date: date, media_type: "movie" as const }),
    overview: overview ?? undefined,
    poster_path: poster,
    vote_average: 0,
  };
}

export interface TvdbSearchRequestBody {
  keyword: string;
  type: "movie" | "tv";
  language?: string;
}

export interface TvdbSearchResponseBody {
  results: Array<{ id: number; name?: string; title?: string; overview?: string; poster_path?: string | null; first_air_date?: string; release_date?: string; vote_average?: number; media_type?: "tv" | "movie" }>;
  page: number;
  total_pages: number;
  total_results: number;
  error?: string;
}

export async function searchTvdb(body: TvdbSearchRequestBody): Promise<TvdbSearchResponseBody> {
  const config = await getTvdbConfig();
  if (config.error) {
    return { results: [], page: 0, total_pages: 0, total_results: 0, error: config.error };
  }
  const token = await getToken(config.host, config.apiKey!);
  if (!token) {
    return { results: [], page: 0, total_pages: 0, total_results: 0, error: "Failed to obtain TVDB auth token. Check your API key." };
  }
  const type = body.type === "movie" ? "movie" : "series";
  const query = encodeURIComponent(body.keyword.trim());
  const path = `/search?query=${query}&type=${type}`;
  const { data, error } = await tvdbFetch(config.host, path, token);
  if (error) return { results: [], page: 0, total_pages: 0, total_results: 0, error };
  const list = Array.isArray(data) ? data as TvdbSearchResultItem[] : [];
  const results = list.map(mapTvdbSearchItemToTmdbLike);
  return { results, page: 1, total_pages: 1, total_results: results.length };
}

export interface TvdbSeriesResponseBody {
  data?: unknown;
  error?: string;
}

export async function getTvdbSeries(id: number): Promise<TvdbSeriesResponseBody> {
  if (!id || id <= 0) return { error: "Invalid series ID" };
  const config = await getTvdbConfig();
  if (config.error) return { error: config.error };
  const token = await getToken(config.host, config.apiKey!);
  if (!token) return { error: "Failed to obtain TVDB auth token. Check your API key." };
  const { data, error } = await tvdbFetch(config.host, `/series/${id}/extended`, token);
  if (error) return { error };
  return { data };
}

export interface TvdbMovieResponseBody {
  data?: unknown;
  error?: string;
}

export async function getTvdbMovie(id: number): Promise<TvdbMovieResponseBody> {
  if (!id || id <= 0) return { error: "Invalid movie ID" };
  const config = await getTvdbConfig();
  if (config.error) return { error: config.error };
  const token = await getToken(config.host, config.apiKey!);
  if (!token) return { error: "Failed to obtain TVDB auth token. Check your API key." };
  const { data, error } = await tvdbFetch(config.host, `/movies/${id}/extended`, token);
  if (error) return { error };
  return { data };
}

export function handleTvdb(app: Hono) {
  app.post("/api/tvdb/search", async (c) => {
    try {
      const rawBody = await c.req.json();
      const keyword = typeof (rawBody as Record<string, unknown>).keyword === "string" ? (rawBody as TvdbSearchRequestBody).keyword : "";
      const type = ((rawBody as Record<string, unknown>).type === "movie" || (rawBody as Record<string, unknown>).type === "tv") ? (rawBody as TvdbSearchRequestBody).type : "tv";
      const result = await searchTvdb({ keyword, type });
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "TVDB search route error");
      return c.json({
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
        error: `Failed to process TVDB search request: ${error instanceof Error ? error.message : "Unknown error"}`,
      }, 200);
    }
  });

  app.get("/api/tvdb/series/:id", async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ data: undefined, error: "Invalid series ID" }, 200);
      const result = await getTvdbSeries(id);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "TVDB get series route error");
      return c.json({ data: undefined, error: `Failed to get series: ${error instanceof Error ? error.message : "Unknown error"}` }, 200);
    }
  });

  app.get("/api/tvdb/movie/:id", async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      if (isNaN(id)) return c.json({ data: undefined, error: "Invalid movie ID" }, 200);
      const result = await getTvdbMovie(id);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, "TVDB get movie route error");
      return c.json({ data: undefined, error: `Failed to get movie: ${error instanceof Error ? error.message : "Unknown error"}` }, 200);
    }
  });
}
