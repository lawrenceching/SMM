import { detectOsLocale, resolveMediaLanguage } from "@smm/utils/locale";
import { TmdbClient } from "../clients/TmdbClient";
import { TvdbClient } from "../clients/TvdbClient";
import type { HostPerformanceStore } from "../clients/hostPerformance";
import type { DiscoverPort } from "../ports/DiscoverPort";
import type { FsPort } from "../ports/FsPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { RecognizeFolderDeps } from "./recognizeFolder";
import { UserConfigHelper } from "./userConfigHelper";

export interface CreateRecognitionDepsInput {
  fs: FsPort;
  network: NetworkPort;
  appDataDir: string;
  /** smm.json root; defaults to {@link appDataDir}. */
  userDataDir?: string;
  normalizePosix: (path: string) => string;
  osLocale?: string;
  discover?: DiscoverPort;
  hostPerformance?: HostPerformanceStore;
  onMediaMetadataUpdated?: (folderPath: string) => void;
}

/** Builds recognition deps from platform ports (Core and ImportFolderJob). */
export async function createRecognitionDeps(
  input: CreateRecognitionDepsInput,
): Promise<RecognizeFolderDeps> {
  const userConfig = new UserConfigHelper(input.fs, input.userDataDir ?? input.appDataDir);
  const config = await userConfig.read();
  const language = resolveMediaLanguage({
    preferMediaLanguage: config.preferMediaLanguage,
    configured: config.applicationLanguage,
    osLocale: input.osLocale ?? detectOsLocale(),
  });
  const tmdb = new TmdbClient(input.network, {
    host: config.tmdb?.host,
    apiKey: config.tmdb?.apiKey,
    httpProxy: config.tmdb?.httpProxy,
    reverseProxyUrl: null,
    discover: input.discover,
    hostPerformance: input.hostPerformance,
  });
  const tvdb = new TvdbClient(input.network, {
    host: config.tvdb?.host,
    apiKey: config.tvdb?.apiKey,
    httpProxy: config.tvdb?.httpProxy,
    reverseProxyUrl: null,
    discover: input.discover,
    hostPerformance: input.hostPerformance,
  });
  return {
    fs: input.fs,
    appDataDir: input.appDataDir,
    userDataDir: input.userDataDir,
    normalizePosix: input.normalizePosix,
    tmdb,
    tvdb,
    language,
    primaryDatabase: config.primaryDatabase,
    onMediaMetadataUpdated: input.onMediaMetadataUpdated,
  };
}
