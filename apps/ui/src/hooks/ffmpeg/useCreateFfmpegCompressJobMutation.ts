import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { useJobManager } from "@/hooks/useJobManager"
import {
  buildFfmpegCompressJob,
  type BuildFfmpegCompressJobInput,
} from "@/lib/ffmpegCompressJobFactory"

export function useCreateFfmpegCompressJobMutation(
  options?: Omit<
    UseMutationOptions<string, Error, BuildFfmpegCompressJobInput, unknown>,
    "mutationFn"
  >,
) {
  const { createJob } = useJobManager()

  return useMutation({
    ...options,
    mutationFn: async (input: BuildFfmpegCompressJobInput) => {
      const job = buildFfmpegCompressJob(input)
      return createJob(job)
    },
  })
}
