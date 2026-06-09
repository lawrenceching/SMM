import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  FFMPEG_COMPRESS_ENCODER_CATALOG,
  type FfmpegEncoderInfo,
} from "@core/whitelistedCmd/constants";
import { executeCmdToCompletion } from "@/lib/whitelistedCmd/executeCmdToCompletion";
import { parseFfmpegEncoders } from "./parseFfmpegEncoders";

export interface FfmpegEncodersResult {
  /** All encoder names reported by the local ffmpeg build. */
  available: string[];
  /** Encoder catalog entries (static) that are present in the ffmpeg build. */
  usable: FfmpegEncoderInfo[];
  /** Catalog entries that are *not* present in the ffmpeg build. */
  unavailable: FfmpegEncoderInfo[];
}

const FFMPEG_ENCODERS_TIMEOUT_MS = 15_000;
const STALE_TIME_MS = 60 * 60 * 1000; // 1 hour

export const ffmpegEncodersQueryKey = ["ffmpeg-encoders"] as const;

async function fetchFfmpegEncoders(): Promise<string[]> {
  const result = await executeCmdToCompletion(
    { command: "ffmpeg", args: ["-hide_banner", "-encoders"] },
    { timeoutMs: FFMPEG_ENCODERS_TIMEOUT_MS },
  );
  if (!result.success) {
    throw new Error(result.error || "failed to query ffmpeg encoders");
  }
  return parseFfmpegEncoders(result.stdout);
}

function buildResult(available: string[]): FfmpegEncodersResult {
  const availableSet = new Set(available);
  const usable: FfmpegEncoderInfo[] = [];
  const unavailable: FfmpegEncoderInfo[] = [];
  for (const entry of FFMPEG_COMPRESS_ENCODER_CATALOG) {
    if (availableSet.has(entry.id)) {
      usable.push(entry);
    } else {
      unavailable.push(entry);
    }
  }
  return { available, usable, unavailable };
}

/**
 * React Query hook that returns the list of ffmpeg encoder names available
 * in the current ffmpeg build, plus the static catalog cross-referenced
 * with that list.
 *
 * Falls back to a software-only H.264 default when ffmpeg is unavailable.
 */
export function useFfmpegEncodersQuery(): UseQueryResult<FfmpegEncodersResult, Error> {
  return useQuery<FfmpegEncodersResult, Error>({
    queryKey: ffmpegEncodersQueryKey,
    queryFn: async () => {
      const available = await fetchFfmpegEncoders();
      return buildResult(available);
    },
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS,
    retry: 0,
  });
}

/** Pure helper: build the result for a given available-encoder list. */
export const buildFfmpegEncodersResult = buildResult;
