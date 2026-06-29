/**
 * Wire types for the frontend console log streaming pipeline.
 * Defined separately from the runtime modules so both the buffer (producer)
 * and the flusher (consumer) can import without circular deps.
 */

export type FrontendLogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface SerializedArg {
  kind:
    | "string"
    | "number"
    | "boolean"
    | "null"
    | "undef"
    | "symbol"
    | "object"
    | "error"
    | "circular"
    | "fn"
    | "bigint";
  value: string;
}

export interface FrontendLogEntry {
  level: FrontendLogLevel;
  args: SerializedArg[];
  ts: number;
  url: string;
  sessionId: string;
}

export interface FrontendLogBatch {
  entries: FrontendLogEntry[];
  appVersion: string;
}