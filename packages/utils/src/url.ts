/**
 * Convert file path to URL `file://`
 * @param path can be POSIX path or Windows path or Windows network path
 *
 * Examples:
 * - POSIX: `/home/user/file.txt` -> `file:///home/user/file.txt`
 * - Windows: `C:\Users\file.txt` -> `file:///C:/Users/file.txt`
 * - UNC: `\\server\share\file.txt` -> `file://server/share/file.txt`
 */
export function pathToFileURL(path: string): string {
    // Handle Windows UNC path (\\server\share\...)
    if (path.startsWith('\\\\')) {
        // Convert backslashes to forward slashes and remove leading double backslash
        const normalized = path.slice(2).replace(/\\/g, '/');
        return 'file://' + encodeURI(normalized);
    }

    // Handle Windows path with drive letter (C:\...)
    if (/^[A-Za-z]:/.test(path)) {
        // Convert backslashes to forward slashes
        const normalized = path.replace(/\\/g, '/');
        return 'file:///' + encodeURI(normalized);
    }

    // Handle POSIX path (/home/user/...)
    // Ensure path starts with /
    const normalized = path.startsWith('/') ? path : '/' + path;
    return 'file://' + encodeURI(normalized);
}

/**
 * Convert file URL to file path
 * @param url file URL starting with `file://`
 *
 * Examples:
 * - POSIX: `file:///home/user/file.txt` -> `/home/user/file.txt`
 * - Windows: `file:///C:/Users/file.txt` -> `C:\\Users\\file.txt`
 * - UNC: `file://server/share/file.txt` -> `\\\\server\\share\\file.txt`
 */
export function fileURLToPath(url: string): string {
    if (!url.startsWith('file://')) {
        throw new Error('InvalidArgumentError: URL must start with file://');
    }

    // Remove file:// prefix
    const afterProtocol = url.slice(7);

    // Decode URI components
    const decoded = decodeURI(afterProtocol);

    // Check if it's a Windows drive letter path (starts with /X:/ where X is a letter)
    if (/^\/[A-Za-z]:\//.test(decoded)) {
        // Remove leading slash and convert to backslashes
        return decoded.slice(1).replace(/\//g, '\\');
    }

    // Check if it's a UNC path (no leading slash, has host)
    // UNC URLs look like file://server/share/path (no third slash after file://)
    if (!decoded.startsWith('/')) {
        return '\\\\' + decoded.replace(/\//g, '\\');
    }

    // POSIX path - return as-is (with leading slash)
    return decoded;
}