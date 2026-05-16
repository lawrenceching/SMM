import {
  buildVideoCaptionerTranscribeArgs,
  probeWhitelistedCommand,
} from "@/lib/whitelistedCmd";
import {
  executeCmdToCompletionWithHeaders,
  type ExecuteCmdCompletionResult,
} from "@/lib/whitelistedCmd/executeCmdToCompletion";

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
  executionId?: string;
  logRelativePath?: string;
}

export async function discoverVideoCaptioner(): Promise<VideoCaptionerDiscoverResponse> {
  const probe = await probeWhitelistedCommand("videocaptioner");
  if (probe.available) {
    return { path: "videocaptioner" };
  }
  return { error: probe.error ?? "videocaptioner not found" };
}

function completionToTranscribeResponse(
  result: ExecuteCmdCompletionResult
): VideoCaptionerTranscribeResponse {
  return {
    ...(result.success ? { success: true } : { error: result.error }),
    executionId: result.executionId,
    logRelativePath: result.logRelativePath ?? undefined,
  };
}

export async function transcribeWithVideoCaptioner(
  request: VideoCaptionerTranscribeRequest,
  options?: { executionId?: string; signal?: AbortSignal }
): Promise<VideoCaptionerTranscribeResponse> {
  const args = buildVideoCaptionerTranscribeArgs({
    mediaPath: request.mediaPath,
    asr: request.asr,
    language: request.language,
    wordTimestamps: request.wordTimestamps,
    format: request.format,
  });

  const result = await executeCmdToCompletionWithHeaders(
    { command: "videocaptioner", args },
    {
      timeoutMs: 10 * 60 * 1000,
      signal: options?.signal,
      executionId: options?.executionId,
    }
  );

  return completionToTranscribeResponse(result);
}
