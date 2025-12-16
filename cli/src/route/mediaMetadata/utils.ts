import { getUserDataDir } from "tasks/HelloTask";
import path, { join } from "path";

const userDataDir = getUserDataDir();
export const mediaMetadataDir = path.join(userDataDir, 'metadata');

export function metadataCacheFilePath(folderPathInPosix: string) {
    const filename = folderPathInPosix.replace(/[\/\\:?*|<>"]/g, '_')
    return join(mediaMetadataDir, `${filename}.json`)
}

