import type { FrontendLogEntry, SerializedArg } from "@/types/frontendLog";

const MAX_CAPACITY = 1000;
const FN_STRING_LIMIT = 200;

/**
 * Serialize one console arg into a JSON-safe form.
 * Preserves enough information to reconstruct what the developer saw.
 */
export function serializeArg(arg: unknown): SerializedArg {
  if (arg === null) return { kind: "null", value: "" };
  if (arg === undefined) return { kind: "undef", value: "" };
  const t = typeof arg;
  if (t === "string") return { kind: "string", value: arg };
  if (t === "number") return { kind: "number", value: String(arg) };
  if (t === "boolean") return { kind: "boolean", value: String(arg) };
  if (t === "bigint") return { kind: "bigint", value: `${arg.toString()}n` };
  if (t === "symbol") return { kind: "symbol", value: (arg as symbol).toString() };
  if (t === "function") {
    const src = Function.prototype.toString.call(arg).slice(0, FN_STRING_LIMIT);
    return { kind: "fn", value: src };
  }
  if (arg instanceof Error) {
    const stackLine = arg.stack?.split("\n")[1] ?? "";
    return { kind: "error", value: `${arg.name}: ${arg.message}\n${stackLine}` };
  }
  try {
    return { kind: "object", value: JSON.stringify(arg) };
  } catch {
    return { kind: "circular", value: "[Circular]" };
  }
}

/**
 * In-memory ring buffer of FrontendLogEntry. FIFO eviction at capacity.
 */
export class FrontendLogBuffer {
  private entries: FrontendLogEntry[] = [];
  private readonly capacity: number;

  constructor(capacity: number = MAX_CAPACITY) {
    this.capacity = capacity;
  }

  push(entry: FrontendLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
  }

  size(): number {
    return this.entries.length;
  }

  drain(): FrontendLogEntry[] {
    if (this.entries.length === 0) return [];
    const out = this.entries;
    this.entries = [];
    return out;
  }
}
