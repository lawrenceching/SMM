/**
 * UI wrapper around `@smm/core/pipeline/recognizeEpisodes`.
 * Adds MediaMetadataWithFolderFiles convenience + Web Worker async path.
 */
import {
  recognizeEpisodes as recognizeEpisodesPure,
  isVideoFile,
  excludeFiles,
  pattern1,
  pattern2,
  pattern3,
  pattern4,
  preciselyRecognizeEpisodes,
  type RecognizedEpisode,
} from "@smm/core/pipeline/recognizeEpisodes";
import type { MediaMetadataWithFolderFiles } from "@/lib/mediaFolderFiles";
import { getMediaFolderFiles } from "@/lib/mediaFolderFiles";

export type { RecognizedEpisode };
export {
  isVideoFile,
  excludeFiles,
  pattern1,
  pattern2,
  pattern3,
  pattern4,
  preciselyRecognizeEpisodes,
};

export function buildEpisodes(
  mm: MediaMetadataWithFolderFiles,
): { season: number; episode: number }[] {
  const files = getMediaFolderFiles(mm);
  if (
    files.length === 0 ||
    mm.tvShow === undefined ||
    mm.tvShow.seasons === undefined ||
    mm.tvShow.seasons.length === 0
  ) {
    return [];
  }

  const ret: { season: number; episode: number }[] = [];
  for (const season of mm.tvShow.seasons) {
    if (season.episodes === undefined || season.episodes.length === 0) continue;
    for (const episode of season.episodes) {
      ret.push({ season: episode.season, episode: episode.episode });
    }
  }
  return ret;
}

export function fuzzyRecognizeEpisodes(
  _episodes: { season: number; episode: number }[],
  _videoFiles: string[],
): RecognizedEpisode[] {
  return [];
}

/**
 * Sync recognition using folder files from UI metadata.
 */
export function recognizeEpisodes(mm: MediaMetadataWithFolderFiles): RecognizedEpisode[] {
  const files = getMediaFolderFiles(mm);
  return recognizeEpisodesPure(mm, files);
}

/** Request id for matching worker responses when using a singleton worker */
let nextRequestId = 0;

type WorkerMessage =
  | { type: "result"; id: number; payload: RecognizedEpisode[] }
  | { type: "error"; id: number; message: string };

/**
 * Run recognizeEpisodes in a Web Worker to avoid blocking the main thread.
 * Uses a singleton worker; concurrent calls are serialized.
 */
export function recognizeEpisodesAsync(
  mm: MediaMetadataWithFolderFiles,
): Promise<RecognizedEpisode[]> {
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    const worker = getRecognizeEpisodesWorker();

    const onMessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg?.id !== id) return;
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      if (msg.type === "result") {
        resolve(msg.payload);
      } else {
        reject(new Error(msg.message));
      }
    };

    const onError = (err: ErrorEvent) => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      reject(err.message ? new Error(err.message) : new Error("RecognizeEpisodes worker error"));
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({ type: "recognize", id, payload: mm });
  });
}

let workerInstance: Worker | null = null;

function getRecognizeEpisodesWorker(): Worker {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker(new URL("./recognizeEpisodes.worker.ts", import.meta.url), {
    type: "module",
  });
  return workerInstance;
}
