import { getAppDataDir } from "tasks/HelloTask";
import path, { join } from "path";

const appDataDir = getAppDataDir();
export const mediaMetadataDir = path.join(appDataDir, 'metadata');

export function metadataCacheFilePath(folderPathInPosix: string) {
    const filename = folderPathInPosix.replace(/[\/\\:?*|<>"]/g, '_')
    return join(mediaMetadataDir, `${filename}.json`)
}

