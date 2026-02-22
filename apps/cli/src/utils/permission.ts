import { Path } from "@core/path";
import { getUserConfig } from "./config";

function isPosixPath(path: string): boolean {
    return path.startsWith('/')
}

/**
 * Check if given path is allow to read
 * @param path the absolute path for file or folder in POSIX format
 */
export async function allowRead(path: string): Promise<boolean> {
    if(!isPosixPath(path)) {
        throw new Error(`only POSIX format path is supported: ${path}`)
    }

    const userConfig = await getUserConfig()

    if(userConfig.folders === undefined) {
        return false;
    }

    if(path === '/') {
        return false;
    }

    const normalizedPath = Path.posix(path);
    const folders = userConfig.folders.map((folder) => Path.posix(folder));

    for (const folder of folders) {
        if (normalizedPath === folder) {
            return true;
        }
        
        if (normalizedPath.startsWith(folder + '/')) {
            return true;
        }
    }

    return false;
}

export async function allowWrite(path: string): Promise<boolean> {
    // so far, file allowed to read is allow to write
    return await allowRead(path);
}