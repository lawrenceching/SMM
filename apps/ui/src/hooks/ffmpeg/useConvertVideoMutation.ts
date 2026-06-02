import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import {
  convertVideo,
  type FfmpegConvertRequest,
  type FfmpegConvertResponse,
} from "@/api/ffmpeg"

export type { FfmpegConvertRequest }

export function useConvertVideoMutation(
  options?: Omit<
    UseMutationOptions<FfmpegConvertResponse, Error, FfmpegConvertRequest>,
    "mutationFn"
  >
) {
  return useMutation({
    ...options,
    mutationFn: (params: FfmpegConvertRequest) => convertVideo(params),
  })
}
