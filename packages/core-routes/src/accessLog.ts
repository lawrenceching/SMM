import type { CoreRoutesLogger } from "./types.ts";

/** The call surfaces covered by the unified access log (docs/access-log.md). */
export type AccessSource = "http" | "mcp" | "ai-tool" | "socket.io";

/**
 * One completed call on any surface. Emitted as a single pino entry
 * with `msg: "access"` — the stable filter anchor for grep/jq.
 */
export interface AccessEntry {
  source: AccessSource;
  outcome: "ok" | "error";
  durationMs?: number;
  /** mcp / ai-tool */
  tool?: string;
  /** mcp / ai-tool — already passed through `truncateForLog` by callers */
  args?: unknown;
  /** ai-tool, socket.io ack */
  clientId?: string;
  /** http */
  method?: string;
  /** http — pathname without query */
  path?: string;
  /** http — raw query string, only attached when debug is enabled */
  query?: unknown;
  status?: number;
  /** socket.io */
  kind?: "ack" | "broadcast";
  event?: string;
  /** socket.io ack payload — already passed through `truncateForLog` */
  data?: unknown;
  err?: unknown;
  /** http — closed before finish */
  aborted?: boolean;
}

const ACCESS_LOG_MSG = "access";
const DEFAULT_LOG_BUDGET = 2000;

/**
 * Emit one access-log entry. Never throws and silently no-ops without
 * a logger — logging must never break the call path.
 *
 * Level mapping (docs/access-log.md §3.2): outcome=error → error,
 * socket.io broadcast → debug, everything else → info.
 */
export function logAccess(
  logger: CoreRoutesLogger | undefined,
  entry: AccessEntry,
): void {
  if (!logger) return;
  try {
    const level =
      entry.outcome === "error" ? "error" : entry.kind === "broadcast" ? "debug" : "info";
    // Spread into a plain object: `CoreRoutesLogger` takes
    // `Record<string, unknown>` and `AccessEntry` has no index signature.
    logger[level]({ ...entry }, ACCESS_LOG_MSG);
  } catch {
    // Swallow logging failures — never break the request/tool call.
  }
}

/**
 * Safe value for log payloads. Values whose JSON form fits in
 * `budget` pass through unchanged; larger ones degrade to
 * `{ truncated: true, preview }`. Unserializable values (cyclic etc.)
 * become the string `"[unserializable]"`.
 */
export function truncateForLog(value: unknown, budget: number = DEFAULT_LOG_BUDGET): unknown {
  if (value === undefined) return undefined;
  let json: string;
  try {
    json = JSON.stringify(value) ?? String(value);
  } catch {
    return "[unserializable]";
  }
  if (json.length <= budget) return value;
  return { truncated: true, preview: json.slice(0, budget) };
}

/**
 * Error summary for `AccessEntry.err`, mirroring the `serializeError`
 * convention in `chat.ts`: Error → `{ message, name, stack }`,
 * non-Error → `{ value }`.
 */
export function serializeErrorForLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack };
  }
  return { value: String(error) };
}
