/**
 * Validates that a file path (POSIX format) is within the allowlist.
 */
export function validatePathIsInAllowlist(
  filePath: string,
  allowlist: string[],
): boolean {
  return allowlist.some((allowlistItem) => filePath.startsWith(allowlistItem));
}
