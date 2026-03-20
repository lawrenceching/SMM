export interface TVDBv4Links {
  prev?: string | null;
  self?: string | null;
  next?: string | null;
  total_items?: number;
  page_size?: number;
}

export interface TVDBv4Envelope<TData> {
  data: TData;
  status: string;
  message?: string;
  links?: TVDBv4Links;
}

export interface TVDBv4ErrorBody {
  error?: string;
}

export interface TVDBv4LoginResponse {
  data: {
    token: string;
  };
  status: string;
}

// Minimal base record shapes. TVDB returns large payloads; keep forward-compatible.
export type TVDBv4EpisodeBaseRecord = Record<string, unknown> & { id?: number };
export type TVDBv4MovieBaseRecord = Record<string, unknown> & { id?: number };
export type TVDBv4SeasonBaseRecord = Record<string, unknown> & { id?: number };
export type TVDBv4SeriesBaseRecord = Record<string, unknown> & { id?: number };

export interface TVDBv4SeriesSeasonsExtendedResponseEpisode {
  id: number;
  seriesId: number;
  name: string;
  aired: string;
  runtime: number;
  nameTranslations: string[];
  overview: string;
  overviewTranslations: string[];
  image: string;
  imageType: number;
  lastUpdated: string;
  number: number;
  absoluteNumber: number;
  seasonNumber: number;
  finaleType: string | null;
  year: string;
}

export interface TVDBv4SeriesSeasonsExtendedResponse {
  id: number;
  seriesId: number;
  type: {
    id: number;
    name: string;
    type: "official" | "absolute";
    alternateName: string | null;
  };
  image: string;
  imageType: number;
  lastUpdated: string;
  year: string;
  episodes: TVDBv4SeriesSeasonsExtendedResponseEpisode[];
}


export interface TVDBv4Artwork {
  id: string,
  image: string,
  thumbnail: string,
  language: string | null,
  type: number,
  score: number,
  width: number,
  height: number,
  includesText: boolean,
  thumbnailWidth: number,
  thumbnailHeight: number,
  updatedAt: number,
  status: {
    id: number,
    name: string | null,
  },
  tagOptions: Record<string, unknown> | null,
}

/**
 * {
        "id": 2004592,
        "seriesId": 421069,
        "type": {
          "id": 1,
          "name": "Aired Order",
          "type": "official",
          "alternateName": null
        },
        "number": 0,
        "nameTranslations": [],
        "overviewTranslations": [],
        "image": "https://artworks.thetvdb.com/banners/v4/season/2004592/posters/66d5f92d04d1d.jpg",
        "imageType": 7,
        "companies": {
          "studio": null,
          "network": null,
          "production": null,
          "distributor": null,
          "special_effects": null
        },
        "lastUpdated": "2026-03-18 09:25:34"
      }
 */

export interface TVDBv4Season {

  id: number,
  seriesId: number,
  type: {
    id: number,
    name: string,
    type: "official" | "absolute",
    alternateName: string | null,
  },
  number: number,
  nameTranslations: string[],
  overviewTranslations: string[],
  image: string,
  imageType: number,
  companies: {
    studio: string | null,
    network: string | null,
    production: string | null,
    distributor: string | null,
    special_effects: string | null,
  },
  lastUpdated: string,
}

export interface TVDBv4SeriesExtendedResponse {
  id: number,
  name: string,
  image: string,
  nameTranslations: string[],
  overviewTranslations: string[],
  aliases: {language: string, name: string}[]
  firstAired: string,
  lastAired: string,
  nextAired: string,
  score: number,
  status: {
    id: number,
    name: string,
    recordType: string,
    keepUpdated: boolean,
  },
  originalCountry: string,
  originalLanguage: string,
  defaultSeasonType: number,
  isOrderRandomized: boolean,
  lastUpdated: string,
  averageRuntime: number,
  overview: string,
  year: string,
  artworks: TVDBv4Artwork[],
  seasons: TVDBv4Season[],
}

export interface TVDBv4LanguageRecord {
  id: string;
  name?: string;
  nativeName?: string;
  shortCode?: string;
}

export type TVDBv4SearchResult = Record<string, unknown> & {
  id: string;
  objectID: string;
  name: string;
  image_url: string;
  overview: string;
  tvdb_id: string;
  type: "series" | "movie";
  overviews: Record<string, string>;
  translations: Record<string, string>;
};

// Common list params.
export interface TVDBv4ListParams {
  page?: number;
}

export interface TVDBv4ListEpisodesParams extends TVDBv4ListParams {}
export interface TVDBv4ListMoviesParams extends TVDBv4ListParams {}
export interface TVDBv4ListSeasonsParams extends TVDBv4ListParams {}
export interface TVDBv4ListSeriesParams extends TVDBv4ListParams {}

export type TVDBv4SearchType = "series" | "movie";

export interface TVDBv4SearchParams extends TVDBv4ListParams {
  query: string;
  type: TVDBv4SearchType;
  language?: string;
  // Optional, not required by the initial SMM client.
  year?: number;
  country?: string;
  director?: string;
  company?: string;
  network?: string;
  offset?: number;
  limit?: number;
}

// Small fetch abstraction to allow simple mocking in tests.
export interface TVDBv4FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type TVDBv4Fetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<TVDBv4FetchResponse>;

