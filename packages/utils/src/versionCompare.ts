/**
 * Parses a semver-like version string (major.minor.patch).
 * Strips pre-release suffixes (e.g. "1.2.4-test" → 1.2.4).
 */
export function parseVersion(version: string): [number, number, number] | null {
  const trimmed = version.trim();
  const core = trimmed.split("-")[0]?.split("+")[0] ?? "";
  const parts = core.split(".");
  if (parts.length < 1 || parts.length > 3) {
    return null;
  }
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    nums.push(Number.parseInt(part, 10));
  }
  while (nums.length < 3) {
    nums.push(0);
  }
  return [nums[0]!, nums[1]!, nums[2]!];
}

/** Returns true when `latest` is strictly greater than `current`. */
export function isVersionGreater(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) {
      return true;
    }
    if (a[i]! < b[i]!) {
      return false;
    }
  }
  return false;
}
