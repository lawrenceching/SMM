import slash from 'slash';

type FileURI = string;


const WIN_PATH_SEPARATOR = '\\';
const POSIX_PATH_SEPARATOR = '/';

function isWindowsPath(filePath: string): boolean {
  return /^[A-Za-z]:/.test(filePath);
}

function isUncPath(filePath: string): boolean {
  return filePath.startsWith('\\\\');
}

function isPosixPath(filePath: string): boolean {
  return filePath.startsWith('/');
}

export function filePathToUri(filePath: string): FileURI {
  if (isUncPath(filePath)) {
    const parts = filePath.slice(2).split(WIN_PATH_SEPARATOR).filter(part => part !== '');
    return `file://${parts.join(POSIX_PATH_SEPARATOR)}`;
  }

  if (isWindowsPath(filePath)) {
    const normalized = slash(filePath);
    return `file:///${normalized}`;
  }

  if (isPosixPath(filePath)) {
    return `file://${filePath}`;
  }

  throw new Error(`Invalid file path: ${filePath}`);
}

export function uriToFilePath(uri: FileURI): string {
  if (!uri.startsWith('file://')) {
    throw new Error(`Invalid file URI: ${uri}`);
  }

  const pathPart = uri.slice(7);

  if (!pathPart.startsWith(POSIX_PATH_SEPARATOR)) {
    const parts = pathPart.split(POSIX_PATH_SEPARATOR);
    return `\\\\${parts.join(WIN_PATH_SEPARATOR)}`;
  }

  const pathWithoutLeadingSlash = pathPart.slice(1);

  if (/^[A-Za-z]:/.test(pathWithoutLeadingSlash)) {
    const windowsPath = pathWithoutLeadingSlash.replace(/\//g, WIN_PATH_SEPARATOR);
    return windowsPath;
  }

  return pathPart;
}