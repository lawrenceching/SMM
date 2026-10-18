import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { Path } from "@smm/utils/path"
import type { FfmpegCompressOptions } from "@smm/core/whitelistedCmd/constants"
import { ffmpegCompressViaCore } from "@/api/ffmpegCompress"
import {
  applyFfmpegCompressPollUpdate,
  pollFfmpegJob,
  upsertFfmpegCompressJobFromCore,
} from "@/lib/pollFfmpegJob"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import { dirname } from "@/lib/path"

export interface CreateFfmpegCompressJobInput {
  folder?: string
  inputPath: string
  outputPath: string
  compressOptions: FfmpegCompressOptions
  title: string
}

export function useCreateFfmpegCompressJobMutation(
  options?: Omit<
    UseMutationOptions<string, Error, CreateFfmpegCompressJobInput, unknown>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: async (input: CreateFfmpegCompressJobInput) => {
      const inputPath = Path.toPlatformPath(Path.posix(input.inputPath))
      const outputPath = Path.toPlatformPath(Path.posix(input.outputPath))
      const folder = Path.toPlatformPath(
        Path.posix(input.folder?.trim() || dirname(input.inputPath)),
      )
      const title = input.title.trim() || inputPath

      const { id } = await ffmpegCompressViaCore({
        folder,
        inputPath,
        outputPath,
        compressOptions: input.compressOptions,
        title,
      })

      upsertFfmpegCompressJobFromCore({
        id,
        folder,
        inputPath,
        outputPath,
        compressOptions: input.compressOptions,
        title,
        status: "pending",
        progress: 0,
      })

      void pollFfmpegJob(id, "ffmpeg-compress", (job) => {
        applyFfmpegCompressPollUpdate(job)
      }).catch((error: unknown) => {
        console.error("[useCreateFfmpegCompressJobMutation] poll ffmpeg-compress job failed:", error)
        useBackgroundJobsStore.getState().updateJob(id, { status: "failed" })
      })

      return id
    },
  })
}
