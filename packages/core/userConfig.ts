import { Path } from "./path";
import type { UserConfig } from "./types";

/**
 * 
 * @param userConfig - the user config to rename the folder in
 * @param from - the source folder path in POSIX format
 * @param to - the destination folder path in POSIX format
 * @returns 
 */
export function renameFolderInUserConfig(userConfig: UserConfig, from: string, to: string): UserConfig {
    const actualFromPosix = Path.posix(from);
    const actualFromWindows = Path.win(from);
    const actualTo = Path.toPlatformPath(to);

    const newFolders = userConfig.folders
        .map(folder => folder === actualFromPosix ? actualTo : folder)
        .map(folder => folder === actualFromWindows ? actualTo : folder);

    return {
        ...userConfig,
        folders: newFolders,
    }
}