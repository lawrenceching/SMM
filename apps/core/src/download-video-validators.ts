export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string }

export const URL_EMPTY = 'URL_EMPTY'
export const URL_INVALID = 'URL_INVALID'

/**
 * Validates that the URL has a valid http/https format.
 * Site-level support detection is delegated to yt-dlp at probe time.
 */
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

  return { valid: true }
}
