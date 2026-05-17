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
    test?: boolean
}

export const UI_FixedDelayBackgroundJobEvent = 'ui.fixedDelayBackgroundJob'

export type FixedDelayBackgroundJobOutcome = 'succeeded' | 'failed'

export interface OnFixedDelayBackgroundJobEventData {
    delay: number;
    name?: string;
    traceId?: string;
    /** Final job status after delay; defaults to `succeeded`. */
    outcome?: FixedDelayBackgroundJobOutcome;
}

/** Fired when a download-video background job finishes an item; MusicPanel may refresh metadata for `folder`. */
export const UI_DownloadVideoJobFolderRefreshEvent = 'ui.downloadVideoJobFolderRefresh'

export interface OnDownloadVideoJobFolderRefreshEventData {
    folder: string
}

