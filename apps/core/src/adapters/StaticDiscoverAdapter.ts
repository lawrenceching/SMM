import type { DiscoverConfig, DiscoverPort, MediaDatabaseEntry } from "../ports/DiscoverPort";

/**
 * Bundled discover hosts (kept in sync with packages/core-routes FALLBACK_MEDIA_DATABASES).
 * Used by headless CLI when no live /api/discover is available.
 */
export const STATIC_MEDIA_DATABASES: MediaDatabaseEntry[] = [
  {
    type: "tmdb",
    url: "https://mediadb.vercel.app/api/tmdb",
    authorizationMethod: "none",
  },
  {
    type: "tmdb",
    url: "https://1255396852-23teay8jtp.ap-hongkong.tencentscf.com",
    authorizationMethod: "none",
  },
  {
    type: "tvdb",
    url: "https://mediadb.vercel.app/api/tvdb",
    authorizationMethod: "none",
  },
  {
    type: "tvdb",
    url: "https://1255396852-24lotax0vl.ap-hongkong.tencentscf.com",
    authorizationMethod: "none",
  },
];

export class StaticDiscoverAdapter implements DiscoverPort {
  async getDiscoverConfig(): Promise<DiscoverConfig> {
    return {
      mediaDatabases: [...STATIC_MEDIA_DATABASES],
      reverseProxies: [],
    };
  }
}
