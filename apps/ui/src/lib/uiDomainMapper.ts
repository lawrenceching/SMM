import type { MediaMetadata } from "@smm/types";

/**
 * UiDomainMapper handles conversion between UI metadata and domain metadata.
 * This ensures clean separation between UI-specific properties and domain data.
 */

/**
 * Determines if the domain metadata has changed compared to current metadata.
 */
export function hasDomainMetadataChanged(
  current: MediaMetadata | undefined,
  updated: MediaMetadata
): boolean {
  if (!current) {
    return true;
  }

  for (const key of Object.keys(updated) as (keyof MediaMetadata)[]) {
    const currentValue = current[key];
    const updatedValue = updated[key];

    if (Array.isArray(currentValue) && Array.isArray(updatedValue)) {
      if (JSON.stringify(currentValue) !== JSON.stringify(updatedValue)) {
        return true;
      }
    } else if (currentValue !== updatedValue) {
      return true;
    }
  }

  return false;
}

/** @deprecated Identity helper; metadata cache stores domain data only. */
export function extractPersistableMediaMetadata(metadata: MediaMetadata): MediaMetadata {
  return metadata;
}

/** @deprecated Use domain metadata directly; folder status lives in uiMediaFolderStore. */
export function toUIMediaMetadata(domainMetadata: MediaMetadata): MediaMetadata {
  return domainMetadata;
}

export function mergeUIMetadata(base: MediaMetadata, updates: Partial<MediaMetadata>): MediaMetadata {
  return {
    ...base,
    ...updates,
  };
}
