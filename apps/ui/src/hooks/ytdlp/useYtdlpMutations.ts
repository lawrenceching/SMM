import { useMutation } from "@tanstack/react-query";
import {
  downloadYtdlpVideo,
  extractYtdlpVideoData,
  listYtdlpFormats,
  type YtdlpListFormatsRequest,
} from "@/api/ytdlp";

export function useExtractYtdlpVideoDataMutation() {
  return useMutation({
    mutationFn: (url: string) => extractYtdlpVideoData(url),
  });
}

export function useListYtdlpFormatsMutation() {
  return useMutation({
    mutationFn: (req: YtdlpListFormatsRequest) => listYtdlpFormats(req),
  });
}

export interface DownloadYtdlpVideosInput {
  urls: string[];
  folder: string;
  args: string[];
}

/**
 * Runs yt-dlp downloads sequentially for each URL (same folder and args).
 */
export function useDownloadYtdlpVideosMutation() {
  return useMutation({
    mutationFn: async (input: DownloadYtdlpVideosInput) => {
      const results: Awaited<ReturnType<typeof downloadYtdlpVideo>>[] = [];
      for (const url of input.urls) {
        results.push(
          await downloadYtdlpVideo({
            url,
            folder: input.folder,
            args: input.args,
          })
        );
      }
      return results;
    },
  });
}
