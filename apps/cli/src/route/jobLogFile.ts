import type { Hono } from "hono";
import fs from "fs/promises";
import path from "path";
import { isImportJobLogId, importJobLogFileName } from "@smm/core";
import { getLogDir } from "../utils/config";
import { logger } from "../../lib/logger";
import { COMMAND_LOG_MAX_BYTES } from "./commandLog";

/**
 * Resolves `${logDir}/job-${jobId}.log` and rejects ids that could escape logDir.
 */
export function resolveImportJobLogPath(jobId: string): string | null {
  const id = jobId.trim();
  if (!isImportJobLogId(id)) return null;
  const root = path.resolve(getLogDir());
  const fileName = importJobLogFileName(id);
  const file = path.resolve(root, fileName);
  const rel = path.relative(root, file);
  if (rel.startsWith(`..${path.sep}`) || rel === ".." || path.isAbsolute(rel)) return null;
  if (rel !== fileName) return null;
  return file;
}

/**
 * GET /api/job-log-file/:jobId — raw text of `${logDir}/job-${jobId}.log`.
 * Same truncation headers as `/api/command-log/:executionId`.
 */
export function handleJobLogFile(app: Hono) {
  app.get("/api/job-log-file/:jobId", async (c) => {
    const jobId = c.req.param("jobId") ?? "";
    const logPath = resolveImportJobLogPath(jobId);
    if (!logPath) {
      return c.json({ error: "Invalid job id" }, 400);
    }

    let offset = parseInt(c.req.query("offset") ?? "0", 10);
    if (Number.isNaN(offset) || offset < 0) offset = 0;

    let size: number;
    try {
      const st = await fs.stat(logPath);
      size = st.size;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        return c.json({ error: "Log not found" }, 404);
      }
      logger.warn({ err, jobId, logPath }, "[jobLogFile] stat failed");
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

    const sliceLimit = Math.min(COMMAND_LOG_MAX_BYTES, remaining);
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
      logger.warn({ err, jobId, logPath }, "[jobLogFile] read failed");
      return c.json({ error: "Failed to read log" }, 500);
    } finally {
      await fh.close();
    }
  });
}
