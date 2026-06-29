import os from "node:os";
import { readFile } from "node:fs/promises";
import { getUserConfigPath } from "./config";

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

function walkApiKeys(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) walkApiKeys(item, seen);
    return;
  }

  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "apiKey" && typeof v === "string" && v.trim() !== "") {
      addSensitiveString(v);
    } else {
      walkApiKeys(v, seen);
    }
  }
}

export async function initSensitiveStrings(): Promise<void> {
  // Re-seed: clear first so repeated calls don't accumulate stale entries.
  sensitiveStrings.clear();

  try {
    addSensitiveString(os.hostname());
  } catch (err) {
    // Not fatal — backend can run without hostname masking.
    // We use console.warn (NOT the pino logger) because this runs during
    // logger.ts module init; importing the logger would be a cycle.
    console.warn("[sensitiveBlacklist] failed to read hostname:", err);
  }

  const configPath = getUserConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    walkApiKeys(parsed, new WeakSet());
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return; // No smm.json — that's fine.
    console.warn(
      `[sensitiveBlacklist] failed to parse smm.json at ${configPath}:`,
      err,
    );
  }
}

export function _resetSensitiveStringsForTests(): void {
  sensitiveStrings.clear();
}
