import type { Hono } from "hono";
import { z } from "zod/v3";
import { logger, frontendLogger } from "../../lib/logger";

const RATE_LIMIT_PER_SECOND = 10;

class RateLimiter {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  isAllowed(key: string = "global"): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / 1000) * 1000;
    const nextResetTime = windowStart + 1000;
    const record = this.requestCounts.get(key);
    if (!record || now >= record.resetTime) {
      this.requestCounts.set(key, { count: 1, resetTime: nextResetTime });
      return true;
    }
    if (record.count < RATE_LIMIT_PER_SECOND) {
      record.count++;
      return true;
    }
    return false;
  }
  charge(key: string, credits: number): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / 1000) * 1000;
    const nextResetTime = windowStart + 1000;
    const record = this.requestCounts.get(key);
    if (!record || now >= record.resetTime) {
      this.requestCounts.set(key, { count: credits, resetTime: nextResetTime });
      return true;
    }
    if (record.count + credits <= RATE_LIMIT_PER_SECOND) {
      record.count += credits;
      return true;
    }
    return false;
  }
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requestCounts.entries()) {
      if (now >= record.resetTime) this.requestCounts.delete(key);
    }
  }

  /** Test helper: drop all tracked keys. */
  reset(): void {
    this.requestCounts.clear();
  }
}

const rateLimiter = new RateLimiter();
setInterval(() => rateLimiter.cleanup(), 60_000);

/** Test helper: clear all rate-limit state so tests don't pollute each other. */
export function _resetRateLimiterForTests(): void {
  rateLimiter.reset();
}

const LogLevel = z.enum(["trace", "debug", "info", "warn", "error", "fatal", "log"]);
// Wire format mirrors apps/ui/src/types/frontendLog.ts SerializedArg. Each
// captured console arg is wrapped with its kind so non-string values
// (errors, objects, functions) round-trip without lossy JSON coercion.
const SerializedArg = z.object({
  kind: z.enum([
    "string", "number", "boolean", "null", "undef",
    "symbol", "object", "error", "circular", "fn", "bigint",
  ]),
  value: z.string(),
});
const SingleEntry = z.object({
  level: LogLevel.default("info"),
  // Accept either a pre-formed message string (legacy / direct callers)
  // or the structured args[] array produced by the browser console
  // interceptor. One of the two MUST be present.
  message: z.string().min(1).optional(),
  args: z.array(SerializedArg).optional(),
  context: z.record(z.unknown()).optional(),
  sessionId: z.string().optional(),
  ts: z.number().optional(),
  url: z.string().optional(),
}).refine(
  (e) => typeof e.message === "string" || (Array.isArray(e.args) && e.args.length > 0),
  { message: "Entry must include either `message` (string) or `args` (non-empty array)" },
);
const BatchBody = z.object({
  entries: z.array(SingleEntry).min(1),
  appVersion: z.string().optional(),
});

type SingleEntryT = z.infer<typeof SingleEntry>;
type ParsedBatch = { entries: SingleEntryT[]; appVersion?: string };

/**
 * Join a console arg list into the human-readable string that gets prefixed
 * with `[frontend]` and written to browser.log. Most kinds already carry a
 * string in `value` (the interceptor pre-stringifies objects/errors); only
 * the kinds that benefit from extra decoration get wrapped.
 */
function formatSerializedArg(arg: z.infer<typeof SerializedArg>): string {
  switch (arg.kind) {
    case "string":
    case "number":
    case "boolean":
    case "symbol":
    case "object":
    case "error":
    case "bigint":
      return arg.value;
    case "null":
      return "null";
    case "undef":
      return "undefined";
    case "circular":
      return "[Circular]";
    case "fn":
      // value already truncated to FN_STRING_LIMIT chars by serializeArg
      return `[Function: ${arg.value}]`;
  }
}

function deriveEntryMessage(entry: SingleEntryT): string {
  if (typeof entry.message === "string") return entry.message;
  return (entry.args ?? []).map(formatSerializedArg).join(" ");
}

function parseBody(raw: unknown):
  | { kind: "single"; entry: SingleEntryT }
  | { kind: "array"; entries: SingleEntryT[] }
  | { kind: "batch"; batch: ParsedBatch }
  | { kind: "error"; issues: z.ZodIssue[] } {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "entries" in (raw as object) && Array.isArray((raw as { entries: unknown }).entries)) {
    const r = BatchBody.safeParse(raw);
    return r.success ? { kind: "batch", batch: r.data } : { kind: "error", issues: r.error.issues };
  }
  if (Array.isArray(raw)) {
    const r = z.array(SingleEntry).min(1).safeParse(raw);
    return r.success ? { kind: "array", entries: r.data } : { kind: "error", issues: r.error.issues };
  }
  const r = SingleEntry.safeParse(raw);
  return r.success ? { kind: "single", entry: r.data } : { kind: "error", issues: r.error.issues };
}

export function handleLog(app: Hono): void {
  app.post("/api/log", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch (error) {
      logger.error({ error }, "Failed to parse /api/log body");
      return c.json({ error: "Invalid JSON", details: error instanceof Error ? error.message : "Unknown" }, 400);
    }

    const parsed = parseBody(raw);
    if (parsed.kind === "error") {
      return c.json(
        { error: "Validation failed", details: parsed.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        400,
      );
    }

    let entries: SingleEntryT[];
    let appVersion: string | undefined;
    if (parsed.kind === "single") { entries = [parsed.entry]; }
    else if (parsed.kind === "array") { entries = parsed.entries; }
    else { entries = parsed.batch.entries; appVersion = parsed.batch.appVersion; }

    const MAX_BATCH = Number(process.env.FRONTEND_LOG_BATCH_MAX ?? 200);
    if (entries.length > MAX_BATCH) {
      return c.json({ error: "Batch too large", max: MAX_BATCH, received: entries.length }, 413);
    }

    const credits = Math.max(1, Math.ceil(entries.length / 50));
    if (!rateLimiter.charge("global", credits)) {
      return c.json({ error: "Rate limit exceeded", creditsRequested: credits }, 429);
    }

    const MAX_BYTES = Number(process.env.FRONTEND_LOG_MAX_BYTES ?? 4096);
    for (const entry of entries) {
      const baseCtx = entry.context ?? {};
      const entryMessage = deriveEntryMessage(entry);
      const messageBytes = Buffer.byteLength(entryMessage, "utf8");
      const ctxBytes = Buffer.byteLength(JSON.stringify(baseCtx), "utf8");
      const truncated = messageBytes + ctxBytes > MAX_BYTES;
      let message = entryMessage;
      let context = baseCtx;
      if (truncated) {
        const budget = Math.max(0, MAX_BYTES - ctxBytes - 1);
        message = Buffer.from(entryMessage, "utf8").subarray(0, budget).toString("utf8");
        context = { ...baseCtx, truncated: true };
      }
      const enriched = { ...context, appVersion };
      const line = "[frontend] " + message;
      // Bind `this` to frontendLogger so pino's internal LOG function sees
      // its msgPrefixSym. Detached method calls (e.g. through Record casts)
      // crash with "this[msgPrefixSym] is undefined".
      // Normalize frontend's "log" to pino's "info" so the wire format
      // matches frontend vocabulary while pino still routes through info().
      const pinoLevel = entry.level === "log" ? "info" : entry.level;
      const method = frontendLogger[pinoLevel];
      if (typeof method === "function") {
        method.call(frontendLogger, enriched, line);
      }
    }

    return new Response(null, { status: 204 });
  });
}