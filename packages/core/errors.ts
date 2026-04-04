export function isError(error: string, message: string) {
    return error.startsWith(`${message}:`)

}

export const ExistedFileError = 'File Already Existed';
export function existedFileError(path: string): string {
    return `${ExistedFileError}: ${path}`;
}

export const FileNotFoundError = 'File Not Found';
export function fileNotFoundError(path: string): string {
    return `${FileNotFoundError}: ${path}`;
}

/**
 * Calls `fn` with `args`. Any synchronous exception or async rejection is caught;
 * `noThrow` itself never throws.
 */
export function noThrow<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  ...args: Args
): void {
  if (typeof fn !== 'function') {
    return;
  }
  try {
    void Promise.resolve(fn(...args)).catch(() => {
      /* rejected promise from fn */
    });
  } catch {
    /* synchronous throw from fn */
  }
}