import { videoFileExtensions } from "@core/utils";
import type { MediaMetadata } from "@smm/core";
import { basename, extname } from "./paths";

export interface RecognizedEpisode {
  season: number;
  episode: number;
  file: string;
}

export function isVideoFile(file: string): boolean {
  return videoFileExtensions.includes(extname(file).toLowerCase());
}

const EXCLUDED_FOLDERS = ["/Extras/", "/EXTRAS/", "/Subtitles/"];

export function excludeFiles(files: string[]): string[] {
  return files.filter((file) => !EXCLUDED_FOLDERS.some((folder) => file.includes(folder)));
}

export function pattern1(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  const ret: RecognizedEpisode[] = [];
  for (const { season, episode } of episodes) {
    const pattern = `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
    const target = videoFiles.find((file) => file.includes(pattern));
    if (target !== undefined) ret.push({ season, episode, file: target });
  }
  return ret;
}

export function pattern2(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  const ret: RecognizedEpisode[] = [];
  for (const { season, episode } of episodes) {
    const pattern = `第${season}季第${episode}集`;
    const target = videoFiles.find((file) => file.includes(pattern));
    if (target !== undefined) ret.push({ season, episode, file: target });
  }
  return ret;
}

export function pattern3(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  const ret: RecognizedEpisode[] = [];
  for (const { season, episode } of episodes) {
    const pattern = `第${String(season).padStart(2, "0")}季第${String(episode).padStart(2, "0")}集`;
    const target = videoFiles.find((file) => file.includes(pattern));
    if (target !== undefined) ret.push({ season, episode, file: target });
  }
  return ret;
}

export function pattern4(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  const numberOfSeasons = [...new Set(episodes.map((i) => i.season))];
  if (numberOfSeasons.length !== 1) return [];
  const ret: RecognizedEpisode[] = [];
  for (const { season, episode } of episodes) {
    const regex = new RegExp(`[\\s.\\-_]+${episode}\\.\\w+$`, "i");
    const target = videoFiles.find((file) => regex.test(basename(file)));
    if (target !== undefined) ret.push({ season, episode, file: target });
  }
  return ret;
}

export function buildEpisodes(mm: MediaMetadata): { season: number; episode: number }[] {
  const ret: { season: number; episode: number }[] = [];
  for (const season of mm.tvShow?.seasons ?? []) {
    for (const episode of season.episodes ?? []) {
      ret.push({ season: episode.season, episode: episode.episode });
    }
  }
  return ret;
}

export function preciselyRecognizeEpisodes(
  episodes: { season: number; episode: number }[],
  videoFiles: string[],
): RecognizedEpisode[] {
  let ret = pattern1(episodes, videoFiles);
  if (ret.length > 0) return ret;
  ret = pattern2(episodes, videoFiles);
  if (ret.length > 0) return ret;
  ret = pattern3(episodes, videoFiles);
  if (ret.length > 0) return ret;
  return pattern4(episodes, videoFiles);
}

export function recognizeEpisodes(mm: MediaMetadata, filePaths: string[]): RecognizedEpisode[] {
  if (
    filePaths.length === 0 ||
    mm.tvShow === undefined ||
    mm.tvShow.seasons === undefined ||
    mm.tvShow.seasons.length === 0
  ) {
    return [];
  }
  let videoFiles = filePaths.filter(isVideoFile);
  videoFiles = excludeFiles(videoFiles);
  if (videoFiles.length === 0) return [];
  const episodes = buildEpisodes(mm);
  if (episodes.length === 0) return [];
  return preciselyRecognizeEpisodes(episodes, videoFiles);
}
