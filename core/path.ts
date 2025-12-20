import { flattenDeep, last } from "es-toolkit";
import slash from 'slash';
import filenamify from 'filenamify';
const WIN_PATH_SEPARATOR = '\\';
const POSIX_PATH_SEPARATOR = '/';

function isNotEmpty(part: string) {
    return part.trim() !== '';
}

export function split(path: string) {

    let parts = path.split(':\\').filter(isNotEmpty) // Windows drive letter
    parts = flattenDeep(parts.map(part => part.split('\\').filter(isNotEmpty))) // Windows format
    parts = flattenDeep(parts.map(part => part.split('/').filter(isNotEmpty))) // POSIX format
    return parts;

}

/**
 * This class is designed to handle path operations in a platform-agnostic way.
 * It's also to design for this application's use case.
 * To ensure the path is always under media folder. No accidentally construct path outside of media folder.
 * This class works in both Node.js and browser environment.
 */
export class Path {

    private root: string[];
    private sub: string[];

    /**
     * Indicate if it's a network path (UNC path) in Windows.
     * For example, "\\\\nas.local\\share\\file.mp4" is a UNC path.
     */
    private unc: boolean;

    constructor(root: string, sub?: string) {

        if(root.trim() === '') {
            throw new Error('InvalidArgumentError: root path cannot be empty');
        }

        if(sub !== undefined) {
            if(split(sub).length === 0) {
                if(sub.length === 0) {
                    throw new Error('InvalidArgumentError: sub path cannot be empty');
                } else {
                    throw new Error('InvalidArgumentError: invalid sub path');
                }
                
            }
        }

        if(sub?.trim() === '') {
            throw new Error('InvalidArgumentError: sub path cannot be empty');
        }

        this.unc = root.startsWith('\\\\');

        // Validate root path format
        if (!(root.startsWith('/') ||
              /^[A-Za-z]:/.test(root) ||
              root.startsWith('\\\\'))) {
            throw new Error(`InvalidArgumentError: root=${root}. root path must start with "/" for POSIX format, "C:" for Windows format, or "\\\\" for Windows UNC format`);
        }

        this.root = split(root);
        this.sub = sub === undefined ? [] : split(sub);

        if(this.root.length === 0) {
            throw new Error('InvalidArgumentError: invalid root path');
        }
    }


    _uncPath() {
        const serverName = this.root[0];
        const parentPath = this.root.slice(1).join(WIN_PATH_SEPARATOR);
        const subPath = this.sub.length === 0 ? '' : WIN_PATH_SEPARATOR + this.sub.join(WIN_PATH_SEPARATOR);
        return `\\\\${serverName}\\${parentPath}${subPath}`
    }

    /**
     * Return the absolute path in the specified format.
     * @param type
     * @returns 
     */
    abs(type: "win" | "posix" = "posix") {
        if(type === "win") {
            if(this.unc) {
                return this._uncPath()
            } else {
                if(this.root[0].length !== 1) {
                    // UNC path
                    return this._uncPath()
                }
                const rootFolderPaths = this.root.slice(1).join(WIN_PATH_SEPARATOR);
                const subpath = this.sub.length === 0 ? '' : WIN_PATH_SEPARATOR + this.sub.join(WIN_PATH_SEPARATOR);
                return `${this.root[0]}:${WIN_PATH_SEPARATOR}${rootFolderPaths}${subpath}`
            }
        } else {
            const subpath = this.sub.length === 0 ? '' : POSIX_PATH_SEPARATOR + this.sub.join(POSIX_PATH_SEPARATOR);
            return `${POSIX_PATH_SEPARATOR}${this.root.join(POSIX_PATH_SEPARATOR)}${subpath}`;
        }
    }

    /**
     * Return the relative path in the specified format.
     * @param type
     * @returns 
     */
    rel(type: "win" | "posix" = "posix") {
        if(type === "win") {
            return this.sub.join(WIN_PATH_SEPARATOR);
        } else {
            return this.sub.join(POSIX_PATH_SEPARATOR);
        }
    }

    /**
     * 
     * @returns The file or folder name
     */
    name(): string {
        return last(this.sub) || last(this.root) || '';
    }

    /**
     * Return the root path in POSIX format
     */
    dir(): string {
        return '/' + this.root.join(POSIX_PATH_SEPARATOR);
    }

    cd(subpath: string): Path {
        return new Path(this.dir(), subpath);
    }
    
    platformAbsPath() {
        return Path.isWindows() ? this.abs('win') : this.abs('posix');
    }

    platformRelPath() {
        return Path.isWindows() ? this.rel('win') : this.rel('posix');
    }

    join(subpath: string): Path {
        const parts = split(subpath);
        return new Path(POSIX_PATH_SEPARATOR + this.root.join(POSIX_PATH_SEPARATOR), [...this.sub, ...parts].join(POSIX_PATH_SEPARATOR))
    }

    /**
     * This method is specifically desgined for rename media file scenario in SMM.
     * This method accept the new file name, process the name to remove/replace invalid characters, and return a new Path
     * This method will NOT change the season folder, ONLY update the file name
     * @returns
     */
    filename(newFileName: string): Path {
        if(this.sub.length === 0) {
            throw new Error('InvalidArgumentError: sub path cannot be empty');
        } else {
            const validName = filenamify(newFileName)
            return new Path(POSIX_PATH_SEPARATOR + this.root.join(POSIX_PATH_SEPARATOR), [...this.sub.slice(0, -1), validName].join(POSIX_PATH_SEPARATOR))
        }
        
    }

    /**
     * Return the parent directory path.
     * If the path has a sub path, removes the last element from the sub path.
     * If the path is at root level (no sub path), returns the root path itself.
     * @returns A new Path representing the parent directory
     */
    parent(): Path {
        if(this.sub.length === 0) {
            // At root level, return root itself (no parent above root)
            
            throw new Error('reaching parent folder is not allowed')
        } else {
            // Remove the last element from sub path
            const parentSub = this.sub.slice(0, -1);
            if(parentSub.length === 0) {
                // Sub path is now empty, return root only
                return new Path(POSIX_PATH_SEPARATOR + this.root.join(POSIX_PATH_SEPARATOR));
            } else {
                // Return root with remaining sub path
                return new Path(POSIX_PATH_SEPARATOR + this.root.join(POSIX_PATH_SEPARATOR), parentSub.join(POSIX_PATH_SEPARATOR));
            }
        }
    }

    static fromAbsolutePath(absolutePath: string, root: string) {
        return new Path(root, absolutePath.replace(root, ''));
    }

    static posix(windowsPath: string) {
        const p = new Path(windowsPath);
        return p.abs('posix');
    }

    static win(posixPath: string) {
        const p = new Path(posixPath);
        return p.abs('win');
    }

    /**
     * C:\\Users\\username to C:/Users/username
     * @param windowsPath 
     * @returns 
     */
    static slash(windowsPath: string) {
        return slash(windowsPath);
    }

    static backslash(posixPath: string) {
        return posixPath.replace(POSIX_PATH_SEPARATOR, WIN_PATH_SEPARATOR);
    }

    /**
     * support running in both Node.js and browser environment
     * @returns true if running on Windows, false otherwise
     */
    static isWindows(): boolean {
        // Node.js/Bun environment
        if (typeof process !== 'undefined' && process.platform) {
            return process.platform === "win32";
        }

        // Electron renderer and browser environment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
        if (win) {
            // Check if electron API is available
            const electron = win.electron;
            if (electron?.process?.platform) {
                return electron.process.platform === "win32";
            }

            // Fallback: detect Windows from user agent in browser
            const nav = win.navigator;
            if (nav?.userAgent) {
                return /Win/i.test(nav.userAgent);
            }
        }

        // Default to false if we can't determine
        return false;
    }

    static pathSeparator() {
        return Path.isWindows() ? WIN_PATH_SEPARATOR : POSIX_PATH_SEPARATOR;
    }

    static toPlatformPath(path: string) {
        return Path.isWindows() ? Path.win(path) : Path.posix(path);
    }

    toString() {
        return this.abs();
    }

}