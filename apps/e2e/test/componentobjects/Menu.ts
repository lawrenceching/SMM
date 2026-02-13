/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

interface ImportMediaFolderData {
    type: "tvshow" | "movie" | "music";
    folderPathInPlatformFormat: string;
    traceId?: string;
}

class Menu {
    public async importMediaFolder(data: ImportMediaFolderData) {
        await browser.executeScript(`document.dispatchEvent(new CustomEvent('ui.mediaFolderImported', { detail: arguments[0] }))`, [data]);
    }
}

export default new Menu();