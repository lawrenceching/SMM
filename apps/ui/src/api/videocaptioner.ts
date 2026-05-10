export interface VideoCaptionerDiscoverResponse {
  path?: string;
  error?: string;
}

export type VideoCaptionerTranscribeAsr = "bijian" | "jianying" | "whisper-cpp";

export type VideoCaptionerTranscribeFormat = "srt" | "ass" | "txt" | "json";

export interface VideoCaptionerTranscribeRequest {
  mediaPath: string;
  asr?: VideoCaptionerTranscribeAsr;
  language?: string;
  wordTimestamps?: boolean;
  format?: VideoCaptionerTranscribeFormat;
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
  const body: Record<string, unknown> = { mediaPath: request.mediaPath };
  if (request.asr !== undefined) {
    body.asr = request.asr;
  }
  if (request.language !== undefined) {
    body.language = request.language;
  }
  if (request.wordTimestamps !== undefined) {
    body.wordTimestamps = request.wordTimestamps;
  }
  if (request.format !== undefined) {
    body.format = request.format;
  }
  const resp = await fetch("/api/videocaptioner/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return (await resp.json()) as VideoCaptionerTranscribeResponse;
}
