import {
  ExistedFileError,
  FileNotFoundError,
} from '@smm/types/errorCodes'

export { ExistedFileError, FileNotFoundError }

export function isError(error: string, message: string) {
  return error.startsWith(`${message}:`)
}

export function existedFileError(path: string): string {
  return `${ExistedFileError}: ${path}`
}

export function fileNotFoundError(path: string): string {
  return `${FileNotFoundError}: ${path}`
}

export function noThrow<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  ...args: Args
): void {
  if (typeof fn !== 'function') {
    return
  }
  try {
    void Promise.resolve(fn(...args)).catch(() => {})
  } catch {
    /* sync throw */
  }
}
