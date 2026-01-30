import type { MediaMetadata } from "@core/types";

export interface UIMediaMetadataProps {
    status: 'idle' | 'initializing' | 'ok' | 'folder_not_found' | 'error_loading_metadata',
}

export type UIMediaMetadata = MediaMetadata & UIMediaMetadataProps;

/**
 * Extracts UI-specific props from a UIMediaMetadata object.
 * This ensures all UIMediaMetadataProps are always extracted,
 * even when new props are added to the type.
 */
export function extractUIMediaMetadataProps(
    metadata: UIMediaMetadata
  ): UIMediaMetadataProps {
    const { status } = metadata;
    return { status };
  }