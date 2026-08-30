import type {
  MovieMediaMetadata,
  TmdbMovieDetails,
  TmdbSearchResponseBody,
  TmdbSeasonDetails,
  TmdbSeriesDetails,
  TMDBMovie,
  TMDBTVShow,
  TvShowEpisodeMetadata,
  TvShowMediaMetadata,
  TvShowSeasonMetadata,
} from "@smm/types";
import type { DiscoverPort } from "../ports/DiscoverPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { HostPerformanceStore } from "./hostPerformance";
import {
  fetchMediaDatabase,
  SMM_TMDB_DEFAULT_UPSTREAM,
} from "./mediaDatabaseTransport";

export { SMM_TMDB_DEFAULT_UPSTREAM };

export interface TmdbClientOptions {
  host?: string;
  apiKey?: string;
  httpProxy?: string;
  reverseProxyUrl?: string | null;
  discover?: DiscoverPort;
  hostPerformance?: HostPerformanceStore;
}

export class TmdbClient {
  private readonly host?: string;
  private readonly apiKey?: string;
  private readonly httpProxy?: string;
  private readonly reverseProxyUrl?: string | null;
  private readonly discover?: DiscoverPort;
  private readonly hostPerformance?: HostPerformanceStore;

  constructor(
    private readonly network: NetworkPort,
    options: TmdbClientOptions = {},
  ) {
    this.host = options.host?.trim() || undefined;
    this.apiKey = options.apiKey?.trim() || undefined;
    this.httpProxy = options.httpProxy?.trim() || undefined;
    this.reverseProxyUrl = options.reverseProxyUrl;
    this.discover = options.discover;
    this.hostPerformance = options.hostPerformance;
  }

  private async request<T>(urlPath: string): Promise<T> {
    const resp = await fetchMediaDatabase(this.network, {
      kind: "tmdb",
      path: urlPath,
      configuredHost: this.host,
      apiKey: this.apiKey,
      httpProxy: this.httpProxy,
      reverseProxyUrl: this.reverseProxyUrl,
      discover: this.discover,
      hostPerformance: this.hostPerformance,
    });
    if (!resp.ok) {
      throw new Error(`TMDB request failed: ${resp.status} ${resp.statusText}`);
    }
    return resp.json<T>();
  }

  /**
   * Build a query string using application/x-www-form-urlencoded encoding
   * (spaces → `%20`) so values embed cleanly in a URL path segment.
   */
  private queryString(params: Record<string, string>): string {
    return new URLSearchParams(params).toString().replace(/\+/g, "%20");
  }

  search(keyword: string, type: "movie" | "tv", language: string): Promise<TmdbSearchResponseBody> {
    return this.request<TmdbSearchResponseBody>(
      `/search/${type}?${this.queryString({ query: keyword, language })}`,
    );
  }

  getTvShowById(id: number, language: string): Promise<TmdbSeriesDetails> {
    return this.request<TmdbSeriesDetails>(`/tv/${id}?${this.queryString({ language })}`);
  }

  getTvSeasonById(seriesId: number, seasonNumber: number, language: string): Promise<TmdbSeasonDetails> {
    return this.request<TmdbSeasonDetails>(
      `/tv/${seriesId}/season/${seasonNumber}?${this.queryString({ language })}`,
    );
  }

  getMovieById(id: number, language: string): Promise<TmdbMovieDetails> {
    return this.request<TmdbMovieDetails>(`/movie/${id}?${this.queryString({ language })}`);
  }

  /** Series details + per-season episode lists, mapped to {@link TvShowMediaMetadata}. */
  async getTvShowMediaMetadata(id: number, language: string): Promise<TvShowMediaMetadata> {
    const series = await this.getTvShowById(id, language);
    const seasonDetails: TmdbSeasonDetails[] = [];
    for (const season of series.seasons ?? []) {
      seasonDetails.push(await this.getTvSeasonById(id, season.season_number, language));
    }
    return buildTvShowMediaMetadata(series, seasonDetails);
  }

  async getMovieMediaMetadata(id: number, language: string): Promise<MovieMediaMetadata> {
    const details = await this.getMovieById(id, language);
    return movieMediaMetadataFromTmdbSearch(details);
  }
}

/** TMDB details → unified `tvShow` shape (same as `tvShowMediaMetadataFromTmdbDetails` in apps/ui). */
export function buildTvShowMediaMetadata(
  series: TmdbSeriesDetails,
  seasonDetails: TmdbSeasonDetails[],
): TvShowMediaMetadata {
  const seasons: TvShowSeasonMetadata[] = (seasonDetails ?? []).map((season) => {
    const episodes: TvShowEpisodeMetadata[] = (season.episodes ?? []).map((ep) => ({
      season: ep.season_number,
      episode: ep.episode_number,
      name: ep.name ?? "",
    }));
    return { season: season.season_number, name: season.name ?? "", episodes };
  });

  return {
    id: String(series.id),
    name: series.name,
    database: "TMDB",
    airDate: series.first_air_date,
    seasons,
  };
}

/** TMDB movie (search result or detail) → unified `movie` shape. */
export function movieMediaMetadataFromTmdbSearch(item: TMDBMovie): MovieMediaMetadata {
  return { id: String(item.id), name: item.title, airDate: item.release_date, database: "TMDB" };
}

export type { TMDBTVShow };
