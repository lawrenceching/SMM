import type { MediaMetadata } from "@smm/types"

export const UI_ImportFolderEvent = 'ui.importFolder'

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

/**
 * Fired when the user asks to compress a video.
 * Dispatched by TvShowPanel / MoviePanel / MusicPanel / the app menu;
 * the top-level `VideoCompression` component listens and opens the dialog.
 */
export const UI_AskForVideoCompression = 'ui.askForVideoCompression'

export interface OnAskForVideoCompressionEventData {
    /** Absolute path of the source video. Omit → dialog opens in “select a file” mode. */
    filePath?: string
    /** Display name for the source video. */
    title?: string
    /** Source duration in seconds (shown in the dialog when available). */
    duration?: number
}

/**
 * Fired when the user asks to format-convert a video file.
 * Dispatched by TvShowPanel / MusicPanel / Welcome / the app menu;
 * the top-level `FormatConverter` component listens and opens the dialog.
 */
export const UI_AskForFormatConverter = 'ui.askForFormatConverter'

export interface OnAskForFormatConverterEventData {
    /** Absolute path of the source file. Omit → dialog opens in “select a file” mode. */
    filePath?: string
    /** Display name for the source file. */
    title?: string
    /** Source duration in seconds (shown in the dialog when available). */
    duration?: number
}

/**
 * Fired when the user asks to scrape / refresh the metadata of the current
 * TV show or movie. Dispatched by the TV / movie headers;
 * the top-level `ScrapeMetadata` component listens and runs the scrape dialog.
 */
export const UI_AskForScrape = 'ui.askForScrape'

export interface OnAskForScrapeEventData {
    /** Metadata of the folder to scrape (show / movie identity). */
    mediaMetadata?: MediaMetadata
    title?: string
    description?: string
}

/** Options passed along with a rename-file request. */
export interface RenameFileDialogOptions {
    initialValue?: string
    title?: string
    description?: string
    suggestions?: string[]
}

/**
 * Fired when the user asks to rename a single file.
 * The dialog is transactional — the requester provides an `onConfirm` callback
 * that receives the new name; the top-level `RenameFile` component listens and
 * owns the dialog.
 */
export const UI_AskForRenameFile = 'ui.askForRenameFile'

export interface OnAskForRenameFileEventData {
    onConfirm: (newName: string) => void
    options?: RenameFileDialogOptions
}

