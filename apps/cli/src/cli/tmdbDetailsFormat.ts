/**
 * Format a TMDB details payload as an indented key/value tree for CLI stdout.
 * Prints every enumerable field; omits `undefined` keys; prints `null` as `null`.
 */
export function formatTmdbDetailsTree(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return formatScalar(value)
  }
  return formatObjectOrArray(value, 0).join('\n')
}

function formatScalar(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  return String(value)
}

function indent(depth: number): string {
  return '  '.repeat(depth)
}

function formatObjectOrArray(value: object, depth: number): string[] {
  const lines: string[] = []
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      lines.push(...formatEntry(`[${i}]`, value[i], depth))
    }
    return lines
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (child === undefined) continue
    lines.push(...formatEntry(key, child, depth))
  }
  return lines
}

function formatEntry(key: string, value: unknown, depth: number): string[] {
  const prefix = `${indent(depth)}${key}:`
  if (value !== null && typeof value === 'object') {
    const children = formatObjectOrArray(value, depth + 1)
    if (children.length === 0) {
      return [`${prefix}`]
    }
    return [`${prefix}`, ...children]
  }
  return [`${prefix} ${formatScalar(value)}`]
}
