import { Path } from "@core/path";
import type { FolderType, MediaMetadata } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { JobStage } from "../jobs/types";
import { TmdbClient } from "../clients/TmdbClient";
import { TvdbClient } from "../clients/TvdbClient";
import { isVideoFile, recognizeEpisodes } from "./recognizeEpisodes";
import { recognizeMediaFolder } from "./recognizeMediaFolder";
import { metadataCachePath } from "./paths";
import { UserConfig } from "./userConfig";

export interface ImportFolderPipelineOptions {
  fs: FsPort;
  network: NetworkPort;
  logger: LoggerPort;
  appDataDir: string;
}

export interface ImportFolderPipelineCallbacks {
  onStage?: (stage: JobStage, progress: number) => void;
}

function mediaMetadataType(type: FolderType): MediaMetadata["type"] {
  return type === "tvshow" ? "tvshow-folder" : type === "movie" ? "movie-folder" : "music-folder";
}

export class ImportFolderPipeline {
  constructor(private readonly options: ImportFolderPipelineOptions) {}

  async run(folderPath: string, type: FolderType, cb: ImportFolderPipelineCallbacks = {}): Promise<MediaMetadata> {
    const { fs, logger, appDataDir, network } = this.options;
    const posixPath = Path.posix(folderPath);
    const stages: JobStage[] = [];

    logger.info({ folderPath: posixPath, type }, "importFolder: stage=config");
    const userConfigStore = new UserConfig(fs, appDataDir);
    const userConfig = await userConfigStore.update((config) => ({
      ...config,
      folders: [...new Set([...config.folders, folderPath])],
    }));
    stages.push("config");
    cb.onStage?.("config", 10);

    logger.info({ folderPath: posixPath, type }, "importFolder: stage=metadata");
    const mm: MediaMetadata = {
      mediaFolderPath: posixPath,
      type: mediaMetadataType(type),
      files: [],
      mediaFiles: [],
    };
    stages.push("metadata");
    cb.onStage?.("metadata", 25);

    logger.info({ folderPath: posixPath, type }, "importFolder: stage=listFiles");
    const listed = await fs.listFiles(posixPath);
    mm.files = listed.map((f) => Path.posix(f));
    stages.push("listFiles");
    cb.onStage?.("listFiles", 40);

    if (type === "tvshow" || type === "movie") {
      const language = userConfig.preferMediaLanguage ?? "en-US";
      const tmdb = new TmdbClient(network, userConfig.tmdb);
      const tvdb = new TvdbClient(network, userConfig.tvdb);

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
      cb.onStage?.("recognize", 60);

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
    await fs.writeTextFile(metadataCachePath(appDataDir, posixPath), JSON.stringify(mmToPersist, null, 2));
    stages.push("persist");
    cb.onStage?.("persist", 95);

    return mm;
  }
}
