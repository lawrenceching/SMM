import type { Hono } from "hono";
import fs from "fs/promises";
import path from "path";
import { getLogDir } from "../utils/config";
import { logger } from "../../lib/logger";

/** UUID v4 (same shape as `crypto.randomUUID()`). */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True if `id` is a canonical UUID v4 string (for client-supplied command log correlation). */
export function isCommandExecutionId(id: string): boolean {
  return UUID_V4.test(id.trim());
}

/**
 * Optional `X-Command-Execution-Id` (UUID v4). Empty/absent is OK; present-but-invalid returns an error message.
 */
export function parseOptionalXCommandExecutionId(
  headerValue: string | undefined,
): { id?: string; error?: string } {
  const raw = headerValue?.trim();
  if (!raw) return {};
  if (!isCommandExecutionId(raw)) {
    return { error: "Invalid X-Command-Execution-Id" };
  }
  return { id: raw };
}

export const COMMAND_LOG_MAX_BYTES = 512 * 1024;

export function resolveCommandMainLogPath(executionId: string): string | null {
  if (!isCommandExecutionId(executionId)) return null;
  const root = path.resolve(getLogDir(), "commands");
  const file = path.resolve(root, executionId, "main.log");
  const rel = path.relative(root, file);
  if (rel.startsWith(`..${path.sep}`) || rel === ".." || path.isAbsolute(rel)) return null;
  const normalized = rel.split(path.sep).join("/");
  if (normalized !== `${executionId}/main.log`) return null;
  return file;
}

/**
 * GET /api/command-log/:executionId — returns the raw main.log contents
 * (UTF-8) along with pagination/truncation headers. The UI parses the
 * text on its end (see `extractLatestProgress`); no server-side
 * structure is imposed.
 */
export function handleCommandLog(app: Hono) {
  app.get("/api/command-log/:executionId", async (c) => {
    const executionId = c.req.param("executionId") ?? "";
    const logPath = resolveCommandMainLogPath(executionId);
    if (!logPath) {
      return c.json({ error: "Invalid execution id" }, 400);
    }

    let offset = parseInt(c.req.query("offset") ?? "0", 10);
    if (Number.isNaN(offset) || offset < 0) offset = 0;

    const limitRaw = c.req.query("limit");
    let limit = limitRaw === undefined || limitRaw === "" ? NaN : parseInt(limitRaw, 10);

    let size: number;
    try {
      const st = await fs.stat(logPath);
      size = st.size;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        return c.json({ error: "Log not found" }, 404);
      }
      logger.warn({ err: err, executionId, logPath }, "[commandLog] stat failed");
      return c.json({ error: "Failed to read log" }, 500);
    }

    const remaining = Math.max(0, size - offset);
    if (remaining === 0) {
      c.header("Content-Type", "text/plain; charset=utf-8");
      c.header("X-Log-Total-Bytes", String(size));
      c.header("X-Log-Truncated", "false");
      c.header("X-Log-Read-Offset", String(offset));
      c.header("X-Log-Read-Limit", "0");
      return c.body(new Uint8Array(0), 200);
    }

    const sliceLimit = Number.isNaN(limit) || limit <= 0
      ? Math.min(COMMAND_LOG_MAX_BYTES, remaining)
      : Math.min(COMMAND_LOG_MAX_BYTES, limit, remaining);

    const fh = await fs.open(logPath, "r");
    try {
      const buf = Buffer.alloc(sliceLimit);
      const { bytesRead } = await fh.read(buf, 0, sliceLimit, offset);
      const truncated = offset + bytesRead < size;
      c.header("Content-Type", "text/plain; charset=utf-8");
      c.header("X-Log-Total-Bytes", String(size));
      c.header("X-Log-Truncated", truncated ? "true" : "false");
      c.header("X-Log-Read-Offset", String(offset));
      c.header("X-Log-Read-Limit", String(bytesRead));
      return c.body(new Uint8Array(buf.subarray(0, bytesRead)), 200);
    } catch (err) {
      logger.warn({ err, executionId, logPath }, "[commandLog] read failed");
      return c.json({ error: "Failed to read log" }, 500);
    } finally {
      await fh.close();
    }
  });
}
