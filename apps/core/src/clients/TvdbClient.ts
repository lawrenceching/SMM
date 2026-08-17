import { TVDBv4, type TVDBv4SearchResult } from "@smm/tvdb4";
import type {
  TVDBv4Season,
  TVDBv4SeriesExtendedResponse,
  TVDBv4SeriesSeasonsExtendedResponse,
} from "@smm/tvdb4/types";
import type { MovieMediaMetadata, PreferMediaLanguage, TvShowMediaMetadata } from "@smm/core";
import type { NetworkPort } from "../ports/NetworkPort";

export const SMM_TVDB_DEFAULT_UPSTREAM = "https://mediadb.vercel.app/api/tvdb";

/** IETF BCP 47 media language → TVDB ISO 639-3 code. */
export function mapToTvdbLangCode(lang: "zh-CN" | "en-US" | "ja-JP"): string {
  switch (lang) {
    case "zh-CN":
      return "zho";
    case "en-US":
      return "eng";
    case "ja-JP":
      return "jpn";
    default:
      return "eng";
  }
}

export interface TvdbClientOptions {
  host?: string;
  apiKey?: string;
}

export class TvdbClient {
  private readonly client: TVDBv4;

  constructor(network: NetworkPort, options: TvdbClientOptions = {}) {
    const host = (options.host?.trim() || SMM_TVDB_DEFAULT_UPSTREAM).replace(/\/+$/, "");
    this.client = new TVDBv4({
      baseUrl: host,
      apiKey: options.apiKey ?? "",
      disableAuth: true,
      fetchImpl: (input, init) => network.fetch(input, init),
    });
  }

  async searchSeries(query: string, language: string): Promise<TVDBv4SearchResult[] | undefined> {
    const resp = await this.client.search({
      query,
      type: "series",
      language: mapToTvdbLangCode(language as PreferMediaLanguage),
    });
    return resp.status === "success" ? resp.data : undefined;
  }

  async searchMovie(query: string, language: string): Promise<TVDBv4SearchResult[] | undefined> {
    const resp = await this.client.search({
      query,
      type: "movie",
      language: mapToTvdbLangCode(language as PreferMediaLanguage),
    });
    return resp.status === "success" ? resp.data : undefined;
  }

  async getTvShowMediaMetadata(seriesId: number, language: string): Promise<TvShowMediaMetadata | undefined> {
    const langCode = mapToTvdbLangCode(language as PreferMediaLanguage);
    const m: TvShowMediaMetadata = { id: seriesId.toString(), name: "", database: "TVDB", seasons: [] };

    const translation = await this.client.seriesTranslationByLangCode(seriesId, langCode);
    if (translation.status === "success") m.name = translation.data?.name ?? "";

    const seriesResp = await this.client.seriesExtendedById(seriesId);
    if (seriesResp.status !== "success") return undefined;
    const series = seriesResp.data as TVDBv4SeriesExtendedResponse;
    m.airDate = series.firstAired;

    const seasons = series.seasons.filter((s) => s.type.name === "Aired Order");
    for (const season of seasons) {
      const seasonResp = await this.client.seasonExtendedById(season.id);
      const episodes =
        seasonResp.status === "success"
          ? (seasonResp.data as TVDBv4SeriesSeasonsExtendedResponse).episodes
          : [];
      m.seasons.push({
        season: season.number,
        name: "",
        episodes: episodes.map((ep) => ({ season: ep.seasonNumber, episode: ep.number, name: ep.name ?? "" })),
      });
    }
    return m;
  }

  async getMovieMediaMetadata(movieId: number, language: string): Promise<MovieMediaMetadata | undefined> {
    const langCode = mapToTvdbLangCode(language as PreferMediaLanguage);
    const m: MovieMediaMetadata = { id: movieId.toString(), name: "", database: "TVDB" };

    const translation = await this.client.movieTranslationByLangCode(movieId, langCode);
    if (translation.status === "success") m.name = translation.data?.name ?? "";

    const movieResp = await this.client.movieExtendedById(movieId);
    if (movieResp.status !== "success") return undefined;
    const data = movieResp.data as Record<string, unknown>;
    if (m.name === "") m.name = typeof data.name === "string" ? data.name : "";
    const firstRelease = data.first_release as Record<string, unknown> | undefined;
    if (firstRelease !== undefined && typeof firstRelease.first === "string") {
      m.airDate = firstRelease.first;
    }
    return m;
  }
}

export type { TVDBv4Season };
