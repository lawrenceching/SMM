/** True when disk command log contains a system note marking the CLI run as finished. */
export function isTerminalCommandLogText(text: string): boolean {
  return /client disconnected \(abort\)|\nexit code=|timeout after \d|process error:|spawn failed:/.test(
    text,
  )
}
