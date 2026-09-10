import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import {
  scrapeFolderViaCore,
  type ScrapeFolderParams,
} from "@/api/scrape"

export function useScrapeMutation(
  options?: Omit<
    UseMutationOptions<string, Error, ScrapeFolderParams, unknown>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: (params: ScrapeFolderParams) => scrapeFolderViaCore(params),
  })
}
