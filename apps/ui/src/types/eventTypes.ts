export const UI_MediaFolderImportedEvent = 'ui.mediaFolderImported'

export interface OnMediaFolderImportedEventData {
    type: "tvshow" | "movie" | "music";
    folderPathInPlatformFormat: string;
    traceId?: string;
}

export const UI_FixedDelayBackgroundJobEvent = 'ui.fixedDelayBackgroundJob'

export interface OnFixedDelayBackgroundJobEventData {
    delay: number;
    name?: string;
    traceId?: string;
}

