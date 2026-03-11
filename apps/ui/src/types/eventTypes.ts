export const UI_MediaFolderImportedEvent = 'ui.mediaFolderImported'

export interface OnMediaFolderImportedEventData {
    type: "tvshow" | "movie" | "music";
    folderPathInPlatformFormat: string;
    traceId?: string;
    /**
     * Skip placeholder + auto-select optimistic UI update.
     * Used by media library import which already does batched optimistic updates.
     */
    skipOptimisticUpdate?: boolean;
    /**
     * Called when this import task completes (success or failure).
     * Useful for sequencing async imports.
     */
    onCompleted?: () => void;
}

export const UI_MediaLibraryImportedEvent = 'ui.mediaLibraryImported'

export interface OnMediaLibraryImportedEventData {
    libraryPathInPlatformFormat: string;
    type: "tvshow" | "movie" | "music";
    traceId?: string;
}

export const UI_FixedDelayBackgroundJobEvent = 'ui.fixedDelayBackgroundJob'

export interface OnFixedDelayBackgroundJobEventData {
    delay: number;
    name?: string;
    traceId?: string;
}

