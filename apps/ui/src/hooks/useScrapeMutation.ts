import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import {
  scrapeFolderViaCore,
  type ScrapeFolderV3Params,
} from "@/api/scrapeV3"

export function useScrapeMutation(
  options?: Omit<
    UseMutationOptions<string, Error, ScrapeFolderV3Params, unknown>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: (params: ScrapeFolderV3Params) => scrapeFolderViaCore(params),
  })
}
