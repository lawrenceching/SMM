import { withDevApiUrl } from "@/api/executeCmd";

export interface ExecutablePathInfo {
  configuredPath: string | null;
  discoveredPath: string | null;
}

export interface DiscoverExecutablesData {
  ffmpeg: ExecutablePathInfo;
  ytdlp: ExecutablePathInfo;
  videocaptioner: ExecutablePathInfo;
  quickjs: ExecutablePathInfo;
}

interface DiscoverExecutablesResponseBody {
  data?: DiscoverExecutablesData;
  error?: string;
}

const emptyPathInfo = (): ExecutablePathInfo => ({
  configuredPath: null,
  discoveredPath: null,
});

export async function fetchDiscoverExecutables(): Promise<DiscoverExecutablesData> {
  const response = await fetch(withDevApiUrl("/api/discoverExecutables"));
  const body = (await response.json()) as DiscoverExecutablesResponseBody;
  if (!response.ok) {
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  if (body.error) {
    throw new Error(body.error);
  }
  const data = body.data;
  return {
    ffmpeg: data?.ffmpeg ?? emptyPathInfo(),
    ytdlp: data?.ytdlp ?? emptyPathInfo(),
    videocaptioner: data?.videocaptioner ?? emptyPathInfo(),
    quickjs: data?.quickjs ?? emptyPathInfo(),
  };
}
