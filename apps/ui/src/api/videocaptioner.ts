export interface VideoCaptionerDiscoverResponse {
  path?: string;
  error?: string;
}

export interface VideoCaptionerTranscribeRequest {
  mediaPath: string;
}

export interface VideoCaptionerTranscribeResponse {
  success?: boolean;
  error?: string;
}

export async function discoverVideoCaptioner(): Promise<VideoCaptionerDiscoverResponse> {
  const resp = await fetch("/api/videocaptioner/discover", {
    method: "GET",
  });
  return (await resp.json()) as VideoCaptionerDiscoverResponse;
}

export async function transcribeWithVideoCaptioner(
  request: VideoCaptionerTranscribeRequest
): Promise<VideoCaptionerTranscribeResponse> {
  const resp = await fetch("/api/videocaptioner/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return (await resp.json()) as VideoCaptionerTranscribeResponse;
}
