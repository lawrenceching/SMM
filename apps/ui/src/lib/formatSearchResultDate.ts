const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

/**
 * Format a metadata date for search results.
 * Date-only values (`YYYY-MM-DD`) are UTC calendar dates. `toLocaleDateString`
 * shifts them west of UTC, and some Windows images lack the en-US long-month data.
 */
export function formatSearchResultDate(dateString: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(dateString.trim())
  if (!match) {
    return dateString
  }
  const month = MONTHS[Number(match[2]) - 1]
  const day = Number(match[3])
  if (!month || day < 1 || day > 31) {
    return dateString
  }
  return `${month} ${day}, ${match[1]}`
}
