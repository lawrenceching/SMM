/**
 * Web Worker entry for recognizeEpisodes.
 * Receives MediaMetadata via postMessage, runs recognizeEpisodes in this thread, posts back result.
 */
import { recognizeEpisodes } from './recognizeEpisodes';
import type { MediaMetadata } from '@core/types';
import type { RecognizedEpisode } from './recognizeEpisodes';
import { delay } from 'es-toolkit';
export type WorkerRequest = { type: 'recognize'; id: number; payload: MediaMetadata };
export type WorkerResult = { type: 'result'; id: number; payload: RecognizedEpisode[] };
export type WorkerError = { type: 'error'; id: number; message: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg?.type !== 'recognize') {
    return;
  }
  const { id, payload: mm } = msg;
  try {

    (async () => {

      // TODO: add delay temporarily to test the worker
      await delay(10000);
      const payload = recognizeEpisodes(mm);
      (self as Worker).postMessage({ type: 'result', id, payload } satisfies WorkerResult);

    })()

    
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (self as Worker).postMessage({ type: 'error', id, message } satisfies WorkerError);
  }
};
