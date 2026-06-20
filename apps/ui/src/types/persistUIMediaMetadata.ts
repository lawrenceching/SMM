import type { MediaMetadata } from "@core/types"

/** Write MediaMetadata to disk and refresh caches (e.g. TanStack Query). */
export type PersistUIMediaMetadataFn = (
  path: string,
  metadata: MediaMetadata,
  options?: { traceId?: string }
) => Promise<void>
