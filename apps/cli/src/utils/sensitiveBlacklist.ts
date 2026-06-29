const PLACEHOLDER = "******";
const sensitiveStrings = new Set<string>();

export function addSensitiveString(s: string): void {
  const trimmed = s.trim();
  if (trimmed === "") return;
  sensitiveStrings.add(trimmed);
}

export function maskSensitive(text: string): string {
  if (sensitiveStrings.size === 0) return text;
  if (text === "") return text;
  // Length-descending so a longer match wins over a shorter prefix/substring.
  const sorted = Array.from(sensitiveStrings).sort((a, b) => b.length - a.length);
  let result = text;
  for (const s of sorted) {
    result = result.replaceAll(s, PLACEHOLDER);
  }
  return result;
}

export function _resetSensitiveStringsForTests(): void {
  sensitiveStrings.clear();
}
