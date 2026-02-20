export interface YtdlpDownloadRequest {
  url: string;
  args?: string[];
  folder?: string;
}

export interface YtdlpDownloadResponse {
  success?: boolean;
  error?: string;
  path?: string;
}

export async function downloadYtdlpVideo(
  request: YtdlpDownloadRequest
): Promise<YtdlpDownloadResponse> {
  const resp = await fetch("/api/ytdlp/download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const body = (await resp.json()) as YtdlpDownloadResponse;
  return body;
}

export async function discoverYtdlp(): Promise<{ path?: string; error?: string }> {
  const resp = await fetch("/api/ytdlp/discover", {
    method: "GET",
  });

  return (await resp.json()) as { path?: string; error?: string };
}

export async function getYtdlpVersion(): Promise<{ version?: string; error?: string }> {
  const resp = await fetch("/api/ytdlp/version", {
    method: "GET",
  });

  return (await resp.json()) as { version?: string; error?: string };
}
