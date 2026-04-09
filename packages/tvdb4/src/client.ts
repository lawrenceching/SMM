import type {
  TVDBv4Envelope,
  TVDBv4EpisodeBaseRecord,
  TVDBv4Fetch,
  TVDBv4ListEpisodesParams,
  TVDBv4ListMoviesParams,
  TVDBv4ListParams,
  TVDBv4ListSeasonsParams,
  TVDBv4ListSeriesParams,
  TVDBv4LanguageRecord,
  TVDBv4LoginResponse,
  TVDBv4MovieBaseRecord,
  TVDBv4SearchParams,
  TVDBv4SearchResult,
  TVDBv4SeasonBaseRecord,
  TVDBv4SeriesBaseRecord,
  TVDBv4SeriesSeasonsExtendedResponse,
  TVDBv4FetchResponse,
  TVDBv4ErrorBody,
  TVDBv4SeriesExtendedResponse,
  TVDBv4ArtworkTypeRecord,
} from "./types";
import type { Logger } from "./logger";
import { noopLogger } from "./logger";

export interface TVDBv4ClientOptions {
  apiKey?: string;
  pin?: string;
  baseUrl?: string;
  fetchImpl?: TVDBv4Fetch;
  tokenValidityMs?: number;
  tokenExpiryBufferMs?: number;
  /** Optional pino-compatible logger (e.g. `pino()` or `pino.child({ ... })`). */
  logger?: Logger;
  disableAuth?: boolean;
}

export class TVDBv4Error extends Error {
  url: string;
  status: number;
  body?: unknown;

  constructor(message: string, args: { url: string; status: number; body?: unknown }) {
    super(message);
    this.name = "TVDBv4Error";
    this.url = args.url;
    this.status = args.status;
    this.body = args.body;
  }
}

const TVDB_DEFAULT_BASE_URL = "https://api4.thetvdb.com/v4";
const DEFAULT_TOKEN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000; // Align with existing SMM behavior.
const DEFAULT_TOKEN_EXPIRY_BUFFER_MS = 60 * 60 * 1000; // Refresh 1h early.

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function encodePathSegment(segment: string | number): string {
  return encodeURIComponent(String(segment));
}

async function safeParseJson(resp: TVDBv4FetchResponse): Promise<unknown> {
  let text: string;
  try {
    text = await resp.text();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`tvdb4: safeParseJson failed: ${message}`);
    throw e;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return text;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`tvdb4: safeParseJson failed: ${message}`);
    return text;
  }
}

export class TVDBv4 {
  private readonly apiKey: string;
  private readonly pin?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: TVDBv4Fetch;
  private readonly tokenValidityMs: number;
  private readonly tokenExpiryBufferMs: number;
  private readonly logger: Logger;
  private readonly disableAuth: boolean;
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private loginInFlight: Promise<string> | null = null;

  constructor(options: TVDBv4ClientOptions) {
    this.disableAuth = options.disableAuth ?? true;
    this.apiKey = options.apiKey ?? "";
    this.pin = options.pin;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? TVDB_DEFAULT_BASE_URL);
    this.fetchImpl =
      options.fetchImpl ??
      ((input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => {
        return fetch(input, init) as unknown as Promise<TVDBv4FetchResponse>;
      });
    this.tokenValidityMs = options.tokenValidityMs ?? DEFAULT_TOKEN_VALIDITY_MS;
    this.tokenExpiryBufferMs = options.tokenExpiryBufferMs ?? DEFAULT_TOKEN_EXPIRY_BUFFER_MS;
    this.logger = options.logger ?? noopLogger;
  }

  private tokenStillValid(): boolean {
    if (!this.token) return false;
    return Date.now() < this.tokenExpiresAt - this.tokenExpiryBufferMs;
  }

  async login(): Promise<string> {
    const url = `${this.baseUrl}/login`;
    const payload: Record<string, unknown> = { apikey: this.apiKey };
    if (this.pin && this.pin.trim()) payload.pin = this.pin.trim();

    this.logger.debug({ url }, "tvdb4: login");

    const resp = await this.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const body = await safeParseJson(resp);
      const error = (body as TVDBv4ErrorBody)?.error ?? resp.statusText ?? "TVDB login failed";
      this.logger.error({ status: resp.status, url }, `tvdb4: login failed: ${error}`);
      throw new TVDBv4Error(`TVDB login failed: ${resp.status} ${error}`, { url, status: resp.status, body });
    }

    const json = (await safeParseJson(resp)) as TVDBv4LoginResponse | { data?: { token?: string }; status?: string };
    const token = (json as TVDBv4LoginResponse)?.data?.token ?? (json as any)?.token;
    if (!token || typeof token !== "string") {
      this.logger.error({ status: resp.status, url }, "tvdb4: login response missing token");
      throw new TVDBv4Error("TVDB login response missing token", { url, status: resp.status, body: json });
    }

    this.logger.debug("tvdb4: login ok");
    this.token = token;
    this.tokenExpiresAt = Date.now() + this.tokenValidityMs;
    return token;
  }

  private async ensureToken(): Promise<string> {
    if (this.tokenStillValid()) return this.token!;
    if (this.loginInFlight) return this.loginInFlight;

    this.loginInFlight = this.login().finally(() => {
      this.loginInFlight = null;
    });
    return this.loginInFlight;
  }

  private async request<TData>(
    path: string,
    init: { method: string; headers?: Record<string, string>; query?: URLSearchParams }
  ): Promise<TVDBv4Envelope<TData>> {

    

    
    const queryString = init.query?.toString();
    const url = `${this.baseUrl}${ensureLeadingSlash(path)}${queryString ? `?${queryString}` : ""}`;
    this.logger.debug({ method: init.method, path, url }, "tvdb4: request");

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init.headers ?? {}),
    };
    if(!this.disableAuth) {
      const token = await this.ensureToken();
      headers["Authorization"] = `Bearer ${token}`;
    }

    const resp = await this.fetchImpl(url, {
      method: init.method,
      headers,
    });

    this.logger.debug({ method: init.method, path, status: resp.status }, "tvdb4: response");

    if (!resp.ok) {
      const body = await safeParseJson(resp);
      const error = (body as TVDBv4ErrorBody)?.error ?? resp.statusText ?? "TVDB request failed";
      this.logger.error({ status: resp.status, url }, `tvdb4: request failed: ${error}`);
      throw new TVDBv4Error(`TVDB request failed: ${resp.status} ${error}`, { url, status: resp.status, body });
    }

    const data = (await safeParseJson(resp)) as TVDBv4Envelope<TData>;
    this.logger.debug({ method: init.method, path, status: resp.status, data }, "tvdb4: response body");
    return data;
  }

  private buildQuery(params: Record<string, string | number | undefined | null>): URLSearchParams {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      const str = typeof v === "number" ? String(v) : v;
      if (!str.trim()) continue;
      sp.set(k, str);
    }
    return sp;
  }

  async search(params: TVDBv4SearchParams): Promise<TVDBv4Envelope<TVDBv4SearchResult[]>> {
    const query = params.query.trim();
    const type = params.type;

    const sp = this.buildQuery({
      query,
      type,
      language: params.language?.trim() || undefined,
      year: params.year,
      country: params.country?.trim() || undefined,
      director: params.director?.trim() || undefined,
      company: params.company?.trim() || undefined,
      network: params.network?.trim() || undefined,
      offset: params.offset,
      limit: params.limit,
      page: params.page,
    });

    // GET /search
    return this.request<TVDBv4SearchResult[]>("/search", { method: "GET", query: sp });
  }

  // Episodes
  async episodes(params: TVDBv4ListEpisodesParams = {}): Promise<TVDBv4Envelope<TVDBv4EpisodeBaseRecord[]>> {
    const sp = this.buildQuery({ page: params.page });
    return this.request<TVDBv4EpisodeBaseRecord[]>("/episodes", { method: "GET", query: sp });
  }

  getEpisodes(params: TVDBv4ListEpisodesParams = {}): Promise<TVDBv4Envelope<TVDBv4EpisodeBaseRecord[]>> {
    return this.episodes(params);
  }

  async episodeById(id: number): Promise<TVDBv4Envelope<TVDBv4EpisodeBaseRecord>> {
    return this.request<TVDBv4EpisodeBaseRecord>(`/episodes/${encodePathSegment(id)}`, { method: "GET" });
  }

  getEpisodeById(id: number): Promise<TVDBv4Envelope<TVDBv4EpisodeBaseRecord>> {
    return this.episodeById(id);
  }

  async episodeTranslationByLangCode(id: number, langCode: string): Promise<TVDBv4Envelope<Record<string, string>>> {
    return this.request<Record<string, string>>(
      `/episodes/${encodePathSegment(id)}/translations/${encodePathSegment(langCode)}`,
      { method: "GET" },
    );
  }

  getEpisodeTranslationByLangCode(id: number, langCode: string): Promise<TVDBv4Envelope<Record<string, string>>> {
    return this.episodeTranslationByLangCode(id, langCode);
  }

  // Languages
  async languages(): Promise<TVDBv4Envelope<TVDBv4LanguageRecord[]>> {
    return this.request<TVDBv4LanguageRecord[]>("/languages", { method: "GET" });
  }

  getLanguages(): Promise<TVDBv4Envelope<TVDBv4LanguageRecord[]>> {
    return this.languages();
  }

  // Movies
  async movies(params: TVDBv4ListMoviesParams = {}): Promise<TVDBv4Envelope<TVDBv4MovieBaseRecord[]>> {
    const sp = this.buildQuery({ page: params.page });
    return this.request<TVDBv4MovieBaseRecord[]>("/movies", { method: "GET", query: sp });
  }

  getMovies(params: TVDBv4ListMoviesParams = {}): Promise<TVDBv4Envelope<TVDBv4MovieBaseRecord[]>> {
    return this.movies(params);
  }

  async movieById(id: number): Promise<TVDBv4Envelope<TVDBv4MovieBaseRecord>> {
    return this.request<TVDBv4MovieBaseRecord>(`/movies/${encodePathSegment(id)}`, { method: "GET" });
  }

  getMovieById(id: number): Promise<TVDBv4Envelope<TVDBv4MovieBaseRecord>> {
    return this.movieById(id);
  }

  async movieExtendedById(id: number): Promise<TVDBv4Envelope<TVDBv4MovieBaseRecord>> {
    return this.request<TVDBv4MovieBaseRecord>(`/movies/${encodePathSegment(id)}/extended`, { method: "GET" });
  }

  getMovieExtended(id: number): Promise<TVDBv4Envelope<TVDBv4MovieBaseRecord>> {
    return this.movieExtendedById(id);
  }

  async movieTranslationByLangCode(id: number, langCode: string): Promise<TVDBv4Envelope<Record<string, string>>> {
    return this.request<Record<string, string>>(
      `/movies/${encodePathSegment(id)}/translations/${encodePathSegment(langCode)}`,
      { method: "GET" },
    );
  }

  getMovieTranslationByLangCode(id: number, langCode: string): Promise<TVDBv4Envelope<Record<string, string>>> {
    return this.movieTranslationByLangCode(id, langCode);
  }

  // Seasons
  async seasons(params: TVDBv4ListSeasonsParams = {}): Promise<TVDBv4Envelope<TVDBv4SeasonBaseRecord[]>> {
    const sp = this.buildQuery({ page: params.page });
    return this.request<TVDBv4SeasonBaseRecord[]>("/seasons", { method: "GET", query: sp });
  }

  getSeasons(params: TVDBv4ListSeasonsParams = {}): Promise<TVDBv4Envelope<TVDBv4SeasonBaseRecord[]>> {
    return this.seasons(params);
  }

  async seasonById(id: number): Promise<TVDBv4Envelope<TVDBv4SeasonBaseRecord>> {
    return this.request<TVDBv4SeasonBaseRecord>(`/seasons/${encodePathSegment(id)}`, { method: "GET" });
  }

  getSeasonById(id: number): Promise<TVDBv4Envelope<TVDBv4SeasonBaseRecord>> {
    return this.seasonById(id);
  }

  async seasonExtendedById(id: number): Promise<TVDBv4Envelope<TVDBv4SeriesSeasonsExtendedResponse>> {
    return this.request<TVDBv4SeriesSeasonsExtendedResponse>(`/seasons/${encodePathSegment(id)}/extended`, { method: "GET" });
  }

  getSeasonExtendedById(id: number): Promise<TVDBv4Envelope<TVDBv4SeriesSeasonsExtendedResponse>> {
    return this.seasonExtendedById(id);
  }

  // Series
  async series(params: TVDBv4ListSeriesParams = {}): Promise<TVDBv4Envelope<TVDBv4SeasonBaseRecord[]>> {
    const sp = this.buildQuery({ page: params.page });
    return this.request<TVDBv4SeasonBaseRecord[]>("/series", { method: "GET", query: sp });
  }

  getSeries(params: TVDBv4ListSeriesParams = {}): Promise<TVDBv4Envelope<TVDBv4SeasonBaseRecord[]>> {
    return this.series(params);
  }

  async seriesById(id: number): Promise<TVDBv4Envelope<TVDBv4SeriesBaseRecord>> {
    return this.request<TVDBv4SeriesBaseRecord>(`/series/${encodePathSegment(id)}`, { method: "GET" });
  }

  getSeriesById(id: number): Promise<TVDBv4Envelope<TVDBv4SeriesBaseRecord>> {
    return this.seriesById(id);
  }

  async seriesExtendedById(id: number): Promise<TVDBv4Envelope<TVDBv4SeriesExtendedResponse>> {
    return this.request<TVDBv4SeriesExtendedResponse>(`/series/${encodePathSegment(id)}/extended`, { method: "GET" });
  }

  getSeriesExtended(id: number): Promise<TVDBv4Envelope<TVDBv4SeriesExtendedResponse>> {
    return this.seriesExtendedById(id);
  }

  async seriesTranslationByLangCode(id: number, langCode: string): Promise<TVDBv4Envelope<Record<string, string>>> {
    return this.request<Record<string, string>>(`/series/${id}/translations/${langCode}`, { method: "GET" });
  }

  getSeriesTranslationByLangCode(id: number, langCode: string): Promise<TVDBv4Envelope<Record<string, string>>> {
    return this.seriesTranslationByLangCode(id, langCode);
  }

  async arkworkTypes() {
    return this.request<TVDBv4ArtworkTypeRecord[]>("/artwork/types", { method: "GET" });
  }

  getArtworkTypes() {
    return this.arkworkTypes();
  }

  // Convenience type exports (helps app code avoid importing from ./types)
  static types = null as unknown as {
    TVDBv4Envelope: TVDBv4Envelope<unknown>;
  };
}

export type {
  TVDBv4SearchParams,
  TVDBv4ListEpisodesParams,
  TVDBv4ListMoviesParams,
  TVDBv4ListSeasonsParams,
  TVDBv4ListSeriesParams,
  TVDBv4ListParams,
};

