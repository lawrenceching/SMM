export type MediaDatabaseType = "tmdb" | "tvdb" | "tmdb-asset" | "tvdb-asset";

export type MediaDatabaseAuthorizationMethod = "date-token" | "none";

export interface MediaDatabaseEntry {
  type: MediaDatabaseType;
  url: string;
  authorizationMethod: MediaDatabaseAuthorizationMethod;
}

export interface ReverseProxyEntry {
  id: string;
  type: "general";
  url: string;
  authorizationMethod: MediaDatabaseAuthorizationMethod;
}

/** Subset of UI / core-routes DiscoverConfig used by Core media-database transport. */
export interface DiscoverConfig {
  mediaDatabases: MediaDatabaseEntry[];
  reverseProxies: ReverseProxyEntry[];
}

export interface DiscoverPort {
  getDiscoverConfig(): Promise<DiscoverConfig>;
}
