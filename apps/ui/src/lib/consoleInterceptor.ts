import { serializeArg, FrontendLogBuffer } from "./frontendLogBuffer";
import type { FrontendLogEntry, FrontendLogLevel } from "@/types/frontendLog";

const SESSION_KEY = "smm.frontendLog.sessionId";
const LEVELS: FrontendLogLevel[] = ["log", "info", "warn", "error", "debug"];
type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

let installed = false;
let bufferRef: FrontendLogBuffer | null = null;
const originals: Partial<Record<ConsoleMethod, (...args: unknown[]) => void>> = {};

function getOrCreateSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

/**
 * Wraps the five `console.*` methods to also push serialized entries into
 * the provided buffer. Idempotent: re-invoking is a no-op.
 */
export function installConsoleInterceptor(buffer: FrontendLogBuffer): void {
  if (installed) return;
  installed = true;
  bufferRef = buffer;

  for (const level of LEVELS) {
    originals[level] = console[level].bind(console);
    const original = originals[level]!;
    console[level] = (...args: unknown[]) => {
      original(...args);
      try {
        const entry: FrontendLogEntry = {
          level,
          args: args.map(serializeArg),
          ts: Date.now(),
          url: typeof location !== "undefined" ? location.href : "",
          sessionId: getOrCreateSessionId(),
        };
        bufferRef?.push(entry);
      } catch {
        // Never throw from a console wrapper.
      }
    };
  }
}

/** Test helper: undo the wrapping. Not used in production. */
export function _uninstallConsoleInterceptor(): void {
  if (!installed) return;
  for (const level of LEVELS) {
    const orig = originals[level];
    if (orig) console[level] = orig as Console[ConsoleMethod];
  }
  installed = false;
  bufferRef = null;
}
