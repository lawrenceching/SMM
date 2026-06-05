/**
 * Format a `Date` as `yyyy-MM-dd` in local time.
 * Used as the bearer token for endpoints with `authorizationMethod: "date-token"`.
 */
export function todayDateToken(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
