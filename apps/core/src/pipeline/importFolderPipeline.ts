import { Path } from "@core/path";
import type { FolderType, MediaMetadata } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { JobStage } from "../jobs/types";
import { TmdbClient } from "../clients/TmdbClient";
import { TvdbClient } from "../clients/TvdbClient";
import type { DiscoverPort } from "../ports/DiscoverPort";
import { isVideoFile, recognizeEpisodes } from "./recognizeEpisodes";
import { recognizeMediaFolder } from "./recognizeMediaFolder";
import { UserConfigHelper } from "./userConfigHelper";
import { MediaMetadataHelper } from "./mediaMetadataHelper";

export interface ImportFolderPipelineOptions {
  fs: FsPort;
  network: NetworkPort;
  logger: LoggerPort;
  appDataDir: string;
  /** Discover config for TMDB/TVDB host failover (UI-aligned). */
  discover?: DiscoverPort;
  /** Local SMM reverse proxy URL for custom media-database hosts. */
  reverseProxyUrl?: string | null;
}

export interface ImportFolderPipelineCallbacks {
  onStage?: (stage: JobStage, progress: number, detail?: { title?: string }) => void;
}

function mediaMetadataType(type: FolderType): MediaMetadata["type"] {
  return type === "tvshow" ? "tvshow-folder" : type === "movie" ? "movie-folder" : "music-folder";
}

/** Blank metadata created at the pipeline metadata stage (before listFiles/recognize). */
export function createBlankMediaMetadata(folderPath: string, type: FolderType): MediaMetadata {
  const posixPath = Path.posix(folderPath);
  return {
    mediaFolderPath: posixPath,
    type: mediaMetadataType(type),
    files: [],
    mediaFiles: [],
  };
}

export class ImportFolderPipeline {
  constructor(private readonly options: ImportFolderPipelineOptions) {}

  async run(folderPath: string, type: FolderType, cb: ImportFolderPipelineCallbacks = {}): Promise<MediaMetadata> {
    const { fs, logger, appDataDir, network, discover, reverseProxyUrl } = this.options;
    const posixPath = Path.posix(folderPath);
    const stages: JobStage[] = [];

    logger.info({ folderPath: posixPath, type }, "importFolder: stage=config");
    const userConfigStore = new UserConfigHelper(fs, appDataDir);
    const userConfig = await userConfigStore.update((config) => ({
      ...config,
      folders: [...new Set([...config.folders, folderPath])],
    }));
    stages.push("config");
    cb.onStage?.("config", 10);

    logger.info({ folderPath: posixPath, type }, "importFolder: stage=metadata");
    const mm = createBlankMediaMetadata(folderPath, type);
    stages.push("metadata");
    cb.onStage?.("metadata", 25);

    logger.info({ folderPath: posixPath, type }, "importFolder: stage=listFiles");
    const listed = await fs.listFiles(posixPath);
    mm.files = listed.map((f) => Path.posix(f));
    stages.push("listFiles");
    cb.onStage?.("listFiles", 40);

    if (type === "tvshow" || type === "movie") {
      const language = userConfig.preferMediaLanguage ?? "en-US";
      const tmdb = new TmdbClient(network, {
        ...userConfig.tmdb,
        discover,
        reverseProxyUrl,
      });
      const tvdb = new TvdbClient(network, {
        ...userConfig.tvdb,
        discover,
        reverseProxyUrl,
      });

      logger.info({ folderPath: posixPath, language }, "importFolder: stage=recognize");
      const result = await recognizeMediaFolder(mm, {
        fs,
        tmdb,
        tvdb,
        language,
        primaryDatabase: userConfig.primaryDatabase,
      });
      if (result.tvShow !== undefined) mm.tvShow = result.tvShow;
      if (result.movie !== undefined) mm.movie = result.movie;
      stages.push("recognize");
      const title = result.tvShow?.name ?? result.movie?.name;
      cb.onStage?.(
        "recognize",
        60,
        title !== undefined ? { title } : undefined,
      );

      logger.info({ folderPath: posixPath }, "importFolder: stage=episodes");
      if (type === "tvshow" && mm.tvShow !== undefined) {
        mm.mediaFiles = recognizeEpisodes(mm).map((i) => ({
          absolutePath: i.file,
          seasonNumber: i.season,
          episodeNumber: i.episode,
        }));
      } else if (type === "movie" && mm.movie !== undefined) {
        const firstVideo = (mm.files ?? []).find(isVideoFile);
        mm.mediaFiles = firstVideo === undefined ? [] : [{ absolutePath: firstVideo }];
      }
      stages.push("episodes");
      cb.onStage?.("episodes", 80);
    }

    logger.info({ folderPath: posixPath }, "importFolder: stage=persist");
    const { files: _files, ...mmToPersist } = mm;
    const mediaMetadataStore = new MediaMetadataHelper(fs, appDataDir);
    await mediaMetadataStore.write(mmToPersist);
    stages.push("persist");
    cb.onStage?.("persist", 95);

    return mm;
  }
}
