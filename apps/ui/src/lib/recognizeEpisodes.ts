import { uniq } from 'es-toolkit';
import { extname, basename } from './path';
import { videoFileExtensions } from './utils';
import type { MediaMetadata } from '@core/types';

export interface RecognizedEpisode {
    season: number,
    episode: number,
    file: string,
}

export function isVideoFile(file: string) {
    const ext = extname(file).toLowerCase();
    return videoFileExtensions.includes(ext);
}


export function pattern1(
    episodes: { season: number, episode: number }[],
    videoFiles: string[]
): RecognizedEpisode[] {

    const ret: RecognizedEpisode[] = [];

    for(const { season, episode } of episodes) {
        const sn = season;
        const en = episode;

        const pattern = `S${sn.toString().padStart(2, '0')}E${en.toString().padStart(2, '0')}`;
        const target = videoFiles.find(file => file.includes(pattern));
        if(target) {
            ret.push({ season: sn, episode: en, file: target });
        }
    }
    
    if(ret.length > 0) {
        console.log(`[recongize episode] recognized episode by pattern1 "SXXEYY"`, ret)
    }

    return ret;
}

export function pattern2(
    episodes: { season: number, episode: number }[],
    videoFiles: string[]
): RecognizedEpisode[] {
    // Pattern 2: Chinese format 第X季第Y集 (e.g., 第1季第5集)
    const ret: RecognizedEpisode[] = [];

    for (const { season, episode } of episodes) {
        const pattern = `第${season}季第${episode}集`;
        const target = videoFiles.find(file => file.includes(pattern));
        if (target) {
            ret.push({ season, episode, file: target });
        }
    }

    if (ret.length > 0) {
        console.log(`[recognize episode] recognized episode by pattern2 "第X季第Y集"`, ret);
    }

    return ret;
}

export function pattern3(
    episodes: { season: number, episode: number }[],
    videoFiles: string[]
): RecognizedEpisode[] {
    // Pattern 3: Chinese format with zero-padding (e.g., 第01季第05集)
    const ret: RecognizedEpisode[] = [];

    for (const { season, episode } of episodes) {
        const pattern = `第${season.toString().padStart(2, '0')}季第${episode.toString().padStart(2, '0')}集`;
        const target = videoFiles.find(file => file.includes(pattern));
        if (target) {
            ret.push({ season, episode, file: target });
        }
    }

    if (ret.length > 0) {
        console.log(`[recognize episode] recognized episode by pattern3 "第XX季第YY集"`, ret);
    }

    return ret;
}

export function pattern4(
    episodes: { season: number, episode: number }[],
    videoFiles: string[]
): RecognizedEpisode[] {
    // Pattern 4: If there is only 1 season, match episode by episode number:
    // xxx - 1.mp4, xxx.1.mp4, xxx_1.mp4, xxx 1.mp4, etc.

    const numberOfSeasons = uniq(episodes.map(i => i.season))
    if(numberOfSeasons.length !== 1) {
        // where there are multiple seasons
        // I don't know if "xxx - 1.mp4" is for season 1 or season 2
        return [];
    }

    const ret: RecognizedEpisode[] = [];

    for (const { season, episode } of episodes) {
        // Match basename ending with "<divider><episode>.ext"
        // Divider: one or more of space, hyphen, dot, underscore (e.g. " - 1", ".1", "_1", " 1")
        const regex = new RegExp(`[\\s.\\-_]+${episode}\\.\\w+$`, 'i');
        const target = videoFiles.find((file) => {
            const name = basename(file) ?? '';
            return regex.test(name);
        });
        if (target) {
            ret.push({ season, episode, file: target });
        }
    }

    if (ret.length > 0) {
        console.log(
            `[recognize episode] recognized episode by pattern4 "xxx<divider>N.ext"`,
            ret
        );
    }

    return ret;
}

export function buildEpisodes(mm: MediaMetadata): { season: number, episode: number }[] {
    if( mm.files === undefined 
        || mm.files === null
        || mm.files.length === 0
        || mm.tmdbTvShow === undefined 
        || mm.tmdbTvShow.seasons === undefined
        || mm.tmdbTvShow.seasons.length === 0
        || mm.tmdbTvShow.seasons[0].episodes === undefined
        || mm.tmdbTvShow.seasons[0].episodes.length === 0
    ) {
        return [];
    }

    const ret: { season: number, episode: number }[] = [];

    for(const season of mm.tmdbTvShow.seasons) {
        if(season.episodes === undefined || season.episodes.length === 0) {
            continue;
        }
        for(const episode of season.episodes) {
            ret.push({ season: season.season_number, episode: episode.episode_number });
        }
    }

    return ret;
}

export function preciselyRecognizeEpisodes(
    episodes: { season: number, episode: number }[],
    videoFiles: string[]
): RecognizedEpisode[] {

    let ret: RecognizedEpisode[] = [];

    ret = pattern1(episodes, videoFiles);
    if (ret.length > 0) {
        return ret;
    }

    ret = pattern2(episodes, videoFiles);
    if (ret.length > 0) {
        return ret;
    }

    ret = pattern3(episodes, videoFiles);
    if (ret.length > 0) {
        return ret;
    }

    ret = pattern4(episodes, videoFiles);
    if (ret.length > 0) {
        return ret;
    }

    return ret;
}

export function fuzzyRecognizeEpisodes(
    episodes: { season: number, episode: number }[],
    videoFiles: string[]
): RecognizedEpisode[] {
    // TODO: no solution yet
    return [];
}


const ExcludesFolders = [
    '/Extras/',
    '/EXTRAS/',
    '/Subtitles/',
]

export function excludeFiles(files: string[]) {
    return files.filter(file => !ExcludesFolders.some(folder => file.includes(folder)))
}

/**
 * There are two caller of this method:
 * 1. Media Folder Initialization
 * 2. User Triggered Media Folder Recognition
 * @param mm 
 * @returns 
 */
export function recognizeEpisodes(
    mm: MediaMetadata,
): RecognizedEpisode[] {

    const startTime = performance.now();

    if( mm.files === undefined 
        || mm.files === null
        || mm.files.length === 0
        || mm.tmdbTvShow === undefined 
        || mm.tmdbTvShow.seasons === undefined
        || mm.tmdbTvShow.seasons.length === 0
        || mm.tmdbTvShow.seasons[0].episodes === undefined
        || mm.tmdbTvShow.seasons[0].episodes.length === 0
    ) {
        return [];
    }

    try {

        let videoFiles = mm.files.filter(isVideoFile);
        videoFiles = excludeFiles(videoFiles);

        if(videoFiles.length === 0) {
            console.log(`[recognizeEpisodes] no video files found`)
            return [];
        }

        const episodes = buildEpisodes(mm);

        let ret: RecognizedEpisode[] = [];

        ret = preciselyRecognizeEpisodes(episodes, videoFiles);
        if (ret.length > 0) {
            return ret;
        }

        ret = fuzzyRecognizeEpisodes(episodes, videoFiles);
        if (ret.length > 0) {
            return ret;
        }

        return ret;
    } catch (error) {
        console.error(`[recognizeEpisodes] error:`, error)
        return [];
    } finally {
        const endTime = performance.now();
        console.log(`[recognizeEpisodes] ended in ${endTime - startTime}ms`)
    }

    return [];
}

/** Request id for matching worker responses when using a singleton worker */
let nextRequestId = 0;

type WorkerMessage = { type: 'result'; id: number; payload: RecognizedEpisode[] } | { type: 'error'; id: number; message: string };

/**
 * Run recognizeEpisodes in a Web Worker to avoid blocking the main thread.
 * Uses a singleton worker; concurrent calls are serialized.
 */
export function recognizeEpisodesAsync(mm: MediaMetadata): Promise<RecognizedEpisode[]> {
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    const worker = getRecognizeEpisodesWorker();

    const onMessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg?.id !== id) return;
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      if (msg.type === 'result') {
        resolve(msg.payload);
      } else {
        reject(new Error(msg.message));
      }
    };

    const onError = (err: ErrorEvent) => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      reject(err.message ? new Error(err.message) : new Error('RecognizeEpisodes worker error'));
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ type: 'recognize', id, payload: mm });
  });
}

let workerInstance: Worker | null = null;

function getRecognizeEpisodesWorker(): Worker {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker(new URL('./recognizeEpisodes.worker.ts', import.meta.url), { type: 'module' });
  return workerInstance;
}