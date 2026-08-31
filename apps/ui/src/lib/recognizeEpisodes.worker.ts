/**
 * Web Worker entry for recognizeEpisodes.
 * Receives MediaMetadata via postMessage, runs recognition in this thread, posts back result.
 */
import { recognizeEpisodes, type RecognizedEpisode } from "./recognizeEpisodesUi";
import type { MediaMetadata } from "@smm/types";

export type WorkerRequest = { type: "recognize"; id: number; payload: MediaMetadata };
export type WorkerResult = { type: "result"; id: number; payload: RecognizedEpisode[] };
export type WorkerError = { type: "error"; id: number; message: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg?.type !== "recognize") {
    return;
  }
  const { id, payload: mm } = msg;
  try {
    const payload = recognizeEpisodes(mm);
    (self as unknown as Worker).postMessage({
      type: "result",
      id,
      payload,
    } satisfies WorkerResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ type: "error", id, message } satisfies WorkerError);
  }
};
