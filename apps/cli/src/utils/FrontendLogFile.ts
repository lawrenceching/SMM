import { createStream } from "rotating-file-stream";
import { getLogDir } from "@/utils/config";
import path from "path";

const DEFAULT_ROTATE_SIZE = "10MB";
const DEFAULT_KEEP = 5;
const LOG_FILENAME = "frontend.log";

export function resolveFrontendLogPath(): string {
  return path.join(getLogDir(), LOG_FILENAME);
}

/**
 * Returns a writable stream that rotates `frontend.log` by size, gzips old
 * files, and keeps the configured number of rotations. Defaults: 10MB x 5.
 * Env overrides: FRONTEND_LOG_ROTATE_SIZE, FRONTEND_LOG_ROTATE_KEEP.
 */
export function createFrontendLogStream() {
  const logDir = getLogDir();
  const size = process.env.FRONTEND_LOG_ROTATE_SIZE ?? DEFAULT_ROTATE_SIZE;
  const maxFiles = Number(process.env.FRONTEND_LOG_ROTATE_KEEP ?? DEFAULT_KEEP);
  return createStream(LOG_FILENAME, {
    path: logDir,
    size,
    maxFiles,
    compress: "gzip",
  });
}
