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

export interface TVDBv4LanguageRecord {
  id: string;
  name?: string;
  nativeName?: string;
  shortCode?: string;
}

export type TVDBv4SearchResult = Record<string, unknown> & {
  id?: string | number;
  name?: string;
  primary_language?: string;
  type?: string;
};

// Common list params.
export interface TVDBv4ListParams {
  page?: number;
}

export interface TVDBv4ListEpisodesParams extends TVDBv4ListParams {}
export interface TVDBv4ListMoviesParams extends TVDBv4ListParams {}
export interface TVDBv4ListSeasonsParams extends TVDBv4ListParams {}
export interface TVDBv4ListSeriesParams extends TVDBv4ListParams {}

export type TVDBv4SearchType = "movie" | "tv";

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

