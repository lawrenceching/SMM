import type { MediaMetadata } from "@smm/core/types"
import { MetadataValidationError } from "./metadataErrors"

export type MetadataPatch = Pick<MediaMetadata, "type" | "mediaFiles" | "tvShow" | "movie">

const ALLOWED_PATCH_KEYS = new Set<keyof MetadataPatch>([
  "type",
  "mediaFiles",
  "tvShow",
  "movie",
])

/** Throws MetadataValidationError if patch has disallowed own-keys. */
export function applyMetadataPatch(
  current: MediaMetadata,
  patch: Record<string, unknown>,
): MediaMetadata {
  for (const key of Object.keys(patch)) {
    if (!ALLOWED_PATCH_KEYS.has(key as keyof MetadataPatch)) {
      throw new MetadataValidationError(`Disallowed metadata patch key: ${key}`)
    }
  }

  return {
    ...current,
    ...patch,
  }
}
