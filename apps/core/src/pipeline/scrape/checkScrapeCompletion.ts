import { Path } from "@core/path";
import { imageFileExtensions } from "@core/utils";
import type { MediaMetadata } from "@smm/core";
import type { FsPort } from "../../ports/FsPort";
import { basename, dirname, extname } from "../paths";
import type { ScrapeTaskId } from "./types";

const DEFAULT_COMPLETION: Record<ScrapeTaskId, boolean> = {
  poster: false,
  fanart: false,
  thumbnails: false,
  nfo: false,
};

function hasImageNamed(files: string[], prefix: "poster" | "fanart"): boolean {
  return files.some((file) => {
    const fileName = basename(file);
    if (!fileName) return false;
    return (
      fileName.startsWith(`${prefix}.`) &&
      imageFileExtensions.some((ext) => fileName.toLowerCase().endsWith(ext.toLowerCase()))
    );
  });
}

function checkTvShowNfoCompletion(files: string[], mediaMetadata: MediaMetadata): boolean {
  const tvshowNfoOk = files.some((file) => basename(file) === "tvshow.nfo");
  let episodeNfosOk = true;

  for (const mediaFile of mediaMetadata.mediaFiles ?? []) {
    if (mediaFile.seasonNumber === undefined || mediaFile.episodeNumber === undefined) continue;

    const videoBase = basename(mediaFile.absolutePath);
    if (!videoBase) continue;

    const videoExt = extname(videoBase);
    const noExt = videoExt ? videoBase.slice(0, -videoExt.length) : videoBase;
    const expectedNfo = `${noExt}.nfo`;
    const videoDir = dirname(mediaFile.absolutePath);
    const found = files.some((file) => dirname(file) === videoDir && basename(file) === expectedNfo);

    if (!found) {
      episodeNfosOk = false;
      break;
    }
  }

  return tvshowNfoOk && episodeNfosOk;
}

function checkTvShowThumbnailsCompletion(files: string[], mediaMetadata: MediaMetadata): boolean {
  let recognizedEpisodeCount = 0;

  for (const mediaFile of mediaMetadata.mediaFiles ?? []) {
    if (mediaFile.seasonNumber === undefined || mediaFile.episodeNumber === undefined) continue;

    recognizedEpisodeCount += 1;
    const videoBase = basename(mediaFile.absolutePath);
    if (!videoBase) return false;

    const videoExt = extname(videoBase);
    const noExt = videoBase.replace(videoExt, "");
    const videoDir = dirname(mediaFile.absolutePath);
    const filesInSameDir = files.filter((file) => dirname(file) === videoDir);
    const hasThumb = filesInSameDir.some((file) => {
      const fileName = basename(file);
      if (!fileName) return false;
      return (
        fileName.startsWith(`${noExt}.`) &&
        imageFileExtensions.some((ext) => fileName.toLowerCase().endsWith(ext.toLowerCase()))
      );
    });

    if (!hasThumb) return false;
  }

  return recognizedEpisodeCount > 0;
}

/** Returns whether each scrape artifact already exists on disk (TV show folders only). */
export async function checkScrapeCompletion(
  mediaMetadata: MediaMetadata,
  fs: FsPort,
): Promise<Record<ScrapeTaskId, boolean>> {
  if (!mediaMetadata.mediaFolderPath || mediaMetadata.type !== "tvshow-folder") {
    return { ...DEFAULT_COMPLETION };
  }

  try {
    const files = (await fs.listFiles(mediaMetadata.mediaFolderPath)).map((p) => Path.posix(p));

    return {
      poster: hasImageNamed(files, "poster"),
      fanart: hasImageNamed(files, "fanart"),
      nfo: checkTvShowNfoCompletion(files, mediaMetadata),
      thumbnails: checkTvShowThumbnailsCompletion(files, mediaMetadata),
    };
  } catch {
    return { ...DEFAULT_COMPLETION };
  }
}
