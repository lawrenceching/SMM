import type { MediaMetadata } from "@core/types";

export interface UIMediaMetadataProps {
    /**
     * Indicates it's a media metadata created for testing purposes.
     * In some logic, test media metadata handle differently
     */
    test?: boolean;
    status: 
     'idle' 
     | 'pending_for_initialization'
     | 'initializing' 
     | 'ok' 
     | 'folder_not_found' 
     | 'error_loading_metadata' 
     | 'loading' 
     | 'updating',
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