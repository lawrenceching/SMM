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
const SingleEntry = z.object({
  level: LogLevel.default("info"),
  message: z.string().min(1, "Message is required"),
  context: z.record(z.unknown()).optional(),
});
const BatchBody = z.object({
  entries: z.array(SingleEntry).min(1),
  appVersion: z.string().optional(),
});

type SingleEntryT = z.infer<typeof SingleEntry>;
type ParsedBatch = { entries: SingleEntryT[]; appVersion?: string };

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
    const serverReceivedAt = new Date().toISOString();
    for (const entry of entries) {
      const baseCtx = entry.context ?? {};
      const messageBytes = Buffer.byteLength(entry.message, "utf8");
      const ctxBytes = Buffer.byteLength(JSON.stringify(baseCtx), "utf8");
      const truncated = messageBytes + ctxBytes > MAX_BYTES;
      let message = entry.message;
      let context = baseCtx;
      if (truncated) {
        const budget = Math.max(0, MAX_BYTES - ctxBytes - 1);
        message = Buffer.from(entry.message, "utf8").subarray(0, budget).toString("utf8");
        context = { ...baseCtx, truncated: true };
      }
      const enriched = { ...context, source: "frontend", appVersion, serverReceivedAt };
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