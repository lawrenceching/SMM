/**
 * OpenResty AUTH_METHOD=date-token: UTC calendar day as yyyyMMdd.
 * @see reverse-proxy-readme.md
 */
export function openrestyDateToken(now: Date = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  const d = String(now.getUTCDate()).padStart(2, "0")
  return `${y}${m}${d}`
}
