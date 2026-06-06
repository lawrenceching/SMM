import { Path } from '@core/path'

export function mediaFilePathEqual(a: string | undefined, b: string | undefined): boolean {
  if (a == null || b == null) {
    return false
  }
  try {
    return Path.posix(a) === Path.posix(b)
  } catch {
    return a === b
  }
}
