export interface FfmpegScreenshotsResponse {
  screenshots?: string[];
  error?: string;
}

export async function generateFfmpegScreenshots(
  videoPath: string
): Promise<FfmpegScreenshotsResponse> {
  const encodedPath = encodeURIComponent(videoPath);
  const resp = await fetch(`/api/ffmpeg/screenshots?videoPath=${encodedPath}`, {
    method: "GET",
  });

  return (await resp.json()) as FfmpegScreenshotsResponse;
}
