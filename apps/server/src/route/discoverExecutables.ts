import { Hono } from 'hono'
import { resolveFfmpegPathInfo } from '../utils/Ffmpeg'
import { resolveYtdlpPathInfo } from '../utils/Ytdlp'
import { resolveVideoCaptionerPathInfo } from '../utils/VideoCaptioner'
import { resolveQuickjsPathInfo } from '../utils/QuickJS'

interface ExecutablePathInfo {
  configuredPath: string | null;
  discoveredPath: string | null;
}

interface DiscoverExecutablesData {
  ffmpeg: ExecutablePathInfo;
  ytdlp: ExecutablePathInfo;
  videocaptioner: ExecutablePathInfo;
  quickjs: ExecutablePathInfo;
}

export type DiscoverExecutablesResponseBody = { data: DiscoverExecutablesData }

export async function resolveDiscoverExecutables(): Promise<DiscoverExecutablesResponseBody> {
  const [ffmpeg, ytdlp, videocaptioner, quickjs] = await Promise.all([
    resolveFfmpegPathInfo(),
    resolveYtdlpPathInfo(),
    resolveVideoCaptionerPathInfo(),
    resolveQuickjsPathInfo(),
  ]);
  return {
    data: {
      ffmpeg,
      ytdlp,
      videocaptioner,
      quickjs,
    },
  };
}

export const discoverExecutablesRoute = new Hono().get('/api/discoverExecutables', async (c) => {
  const result = await resolveDiscoverExecutables();
  return c.json<DiscoverExecutablesResponseBody>(result, 200);
});
