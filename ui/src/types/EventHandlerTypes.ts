export interface UIEvent {
    name: string;
    data?: any;
}

export interface UIEventHandler {
    name: string;
    handler: (event: UIEvent) => Promise<void>;
}

export interface OnMediaFolderImportedEventData {
    type: "tvshow" | "movie" | "music";
    folderPathInPlatformFormat: string;
    traceId?: string;
}

export interface OnMediaFolderSelectedEventData {
    mediaFolderPath: string;
    traceId?: string;
}

export const EVENT_APP_START_UP = 'onAppStartUp'
export const EVENT_ON_MEDIA_FOLDER_IMPORTED = 'onMediaFolderImported'
export const EVENT_ON_MEDIA_FOLDER_SELECTED = 'onMediaFolderSelected'