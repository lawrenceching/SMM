import type { Hono } from 'hono';
import { resolveFfmpegPathInfo } from '../utils/Ffmpeg';
import { resolveYtdlpPathInfo } from '../utils/Ytdlp';
import { discoverVideoCaptioner } from '../utils/VideoCaptioner';

export interface ExecutablePathInfo {
  configuredPath: string | null;
  discoveredPath: string | null;
}

export interface DiscoverExecutablesData {
  ffmpeg: ExecutablePathInfo;
  ytdlp: ExecutablePathInfo;
  videocaptioner: ExecutablePathInfo;
}

export interface DiscoverExecutablesResponseBody {
  data?: DiscoverExecutablesData;
  error?: string;
}

export async function resolveDiscoverExecutables(): Promise<DiscoverExecutablesResponseBody> {
  const [ffmpeg, ytdlp, videocaptionerPath] = await Promise.all([
    resolveFfmpegPathInfo(),
    resolveYtdlpPathInfo(),
    discoverVideoCaptioner(),
  ]);
  return {
    data: {
      ffmpeg,
      ytdlp,
      videocaptioner: {
        configuredPath: null,
        discoveredPath: videocaptionerPath ?? null,
      },
    },
  };
}

export function handleDiscoverExecutables(app: Hono) {
  app.get('/api/discoverExecutables', async (c) => {
    const result = await resolveDiscoverExecutables();
    return c.json(result);
  });
}
