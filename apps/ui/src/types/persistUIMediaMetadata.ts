import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

/** Write UIMediaMetadata to disk and refresh caches (e.g. TanStack Query + Zustand). */
export type PersistUIMediaMetadataFn = (
  path: string,
  metadata: UIMediaMetadata,
  options?: { traceId?: string }
) => Promise<void>
