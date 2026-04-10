interface ImportMediaFolderData {
    type: "tvshow" | "movie" | "music";
    folderPathInPlatformFormat: string;
    traceId?: string;
    test?: boolean;
}

export async function importMediaFolder(data: ImportMediaFolderData) {
    await browser.executeScript(`document.dispatchEvent(new CustomEvent('ui.mediaFolderImported', { detail: arguments[0] }))`, [data]);
}



export const UI_MediaLibraryImportedEvent = 'ui.mediaLibraryImported'

/**
 * Copy from apps\ui\src\types\eventTypes.ts
 */
export interface OnMediaLibraryImportedEventData {
    libraryPathInPlatformFormat: string;
    type: "tvshow" | "movie" | "music";
    traceId?: string;
    test?: boolean
}

export async function importMediaLibrary(data: OnMediaLibraryImportedEventData) {
    console.log(`emitting ${UI_MediaLibraryImportedEvent} event with data: ${JSON.stringify(data)}`)
    await browser.executeScript(`document.dispatchEvent(new CustomEvent('${UI_MediaLibraryImportedEvent}', { detail: arguments[0] }))`, [data]);
}