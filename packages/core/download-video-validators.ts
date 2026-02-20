export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string }

export const URL_EMPTY = 'URL_EMPTY'
export const URL_INVALID = 'URL_INVALID'
export const URL_PLATFORM_NOT_ALLOWED = 'URL_PLATFORM_NOT_ALLOWED'

export const ALLOWED_HOSTNAMES: readonly string[] = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'music.youtube.com',
  'bilibili.com',
  'www.bilibili.com',
  'm.bilibili.com',
  'b23.tv',
]

export function validateDownloadUrl(url: string): ValidationResult {
  if (!url.trim()) {
    return { valid: false, error: URL_EMPTY }
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, error: URL_INVALID }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: URL_INVALID }
  }

  if (!parsed.hostname) {
    return { valid: false, error: URL_INVALID }
  }

  if (!ALLOWED_HOSTNAMES.includes(parsed.hostname)) {
    return { valid: false, error: URL_PLATFORM_NOT_ALLOWED }
  }

  return { valid: true }
}
