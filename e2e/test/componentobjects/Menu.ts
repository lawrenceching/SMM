
class Menu {
    public async importMediaFolder(data:  {
        type: "tvshow" | "movie" | "music";
        folderPathInPlatformFormat: string;
        traceId?: string;
    }) {
        const event = new CustomEvent('ui.mediaFolderImported', {
            detail: data
        });
        document.dispatchEvent(event);
    }
}

export default new Menu();