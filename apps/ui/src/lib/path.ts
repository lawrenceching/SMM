
import pathBrowserify from 'path-browserify-esm'

export const WindowsPathSeparator = '\\'
export const UnixPathSeparator = '/'

export function isWindowsPath(path: string) {
    return path.includes(':\\');
}

export function isAbsPath(path: string) {
    return path.startsWith('/') || path.startsWith('\\') || path.includes(':\\')
}

export function join(...paths: string[]) {

    if(paths.length === 0) {
        return ''
    }

    if(paths.length === 1) {
        return paths[0]
    }

    const root = paths[0]
    
    if(isWindowsPath(root)) {
        // Windows path
        return paths.join(WindowsPathSeparator)
    } else {
        // Unix path
        return paths.join(UnixPathSeparator)
    }

}

export function basename(path: string) {
    if(isWindowsPath(path)) {
        // Windows path
        return path.split(WindowsPathSeparator).pop()
    } else {
        // Unix path
        return path.split(UnixPathSeparator).pop()
    }
}

export function dirname(path: string) {
    if(isWindowsPath(path)) {
        // Windows path
        return path.split(WindowsPathSeparator).slice(0, -1).join(WindowsPathSeparator)
    } else {
        // Unix path
        return path.split(UnixPathSeparator).slice(0, -1).join(UnixPathSeparator)
    }
}

export function relative(from: string, to: string) {

    const isWindowsPathOfFromPath = isWindowsPath(from)
    const isWindowsPathOfToPath = isWindowsPath(to)

    if(isWindowsPathOfFromPath && isWindowsPathOfToPath) {
        // Windows path
        // TODO: only work when to is subfolder of from
        // It does not work in below case:
        // path.relative('C:\\orandea\\test\\aaa', 'C:\\orandea\\impl\\bbb');
        // Returns: '..\\..\\impl\\bbb' 
        if(to.startsWith(from)) {
            return to.replace(from + WindowsPathSeparator, '')
        } else {
            throw new Error(`Unsupported Condition: to is not subfolder of from: from=${from}, to=${to}`)
        }
    } else if(!isWindowsPathOfFromPath && !isWindowsPathOfToPath) {
        // Unix path
        return pathBrowserify.relative(from, to)
    } else {
        throw new Error(`Path from different platforms: ${from} and ${to}`)
    }

}

/**
 * 
 * @param path
 * @returns The extension of the path, including the leading dot
 */
export function extname(path: string) {
    const words = path.split('.')
    if(words.length === 1) {
        return ''
    }
    return "." + words.pop()
}