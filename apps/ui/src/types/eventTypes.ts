export const UI_MediaFolderImportedEvent = 'ui.mediaFolderImported'

export interface OnMediaFolderImportedEventData {
    type: "tvshow" | "movie" | "music";
    folderPathInPlatformFormat: string;
    traceId?: string;
}

