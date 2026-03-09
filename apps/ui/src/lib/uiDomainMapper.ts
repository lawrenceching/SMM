import type { MediaMetadata } from "@core/types";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";

/**
 * UiDomainMapper handles conversion between UI metadata and domain metadata.
 * This ensures clean separation between UI-specific properties and domain data.
 */

/**
 * Determines if the domain metadata has changed compared to current UI metadata.
 * Only considers MediaMetadata properties, excluding UI-only fields like 'status'.
 */
export function hasDomainMetadataChanged(
  current: UIMediaMetadata | undefined,
  updated: UIMediaMetadata
): boolean {
  if (!current) {
    return true;
  }

  const uiOnlyKeys: (keyof UIMediaMetadata)[] = ['status'];

  // Compare all keys in the updated object
  for (const key of Object.keys(updated) as (keyof UIMediaMetadata)[]) {
    // Skip UI-only keys
    if (uiOnlyKeys.includes(key)) {
      continue;
    }

    const currentValue = current[key];
    const updatedValue = updated[key];

    // Handle arrays (e.g., mediaFiles, seasons)
    if (Array.isArray(currentValue) && Array.isArray(updatedValue)) {
      if (JSON.stringify(currentValue) !== JSON.stringify(updatedValue)) {
        return true;
      }
    } else if (currentValue !== updatedValue) {
      // Handle null/undefined/primitive value differences
      return true;
    }
  }

  return false;
}

/**
 * Extracts persistable domain metadata from UI metadata by removing UI-only properties.
 */
export function extractPersistableMediaMetadata(uiMetadata: UIMediaMetadata): MediaMetadata {
  const { status, ...domainMetadata } = uiMetadata;
  return domainMetadata as MediaMetadata;
}

/**
 * Converts domain metadata to UI metadata with default UI properties.
 */
export function toUIMediaMetadata(domainMetadata: MediaMetadata, uiProps?: Partial<UIMediaMetadata>): UIMediaMetadata {
  return {
    ...domainMetadata,
    status: 'idle',
    ...uiProps,
  };
}

/**
 * Updates UI metadata while preserving or updating UI-specific properties.
 */
export function mergeUIMetadata(base: UIMediaMetadata, updates: Partial<UIMediaMetadata>): UIMediaMetadata {
  return {
    ...base,
    ...updates,
  };
}