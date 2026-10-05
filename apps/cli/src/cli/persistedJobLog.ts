import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { importJobLogFileName, isImportJobLogId } from "@smm/core";
import { getLogDir } from "../utils/config";

function resolvePersistedImportJobLogPath(jobId: string): string | null {
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

/** Job ids that already have `${logDir}/job-${id}.log` on disk. */
export async function listPersistedImportJobIds(logDir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(logDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return names
    .filter((name) => name.startsWith("job-") && name.endsWith(".log"))
    .map((name) => name.slice("job-".length, -".log".length))
    .filter((id) => isImportJobLogId(id))
    .sort();
}

/** Log file text for a finished import, or null when the file is missing. */
export async function readPersistedJobLog(jobId: string): Promise<string | null> {
  const file = resolvePersistedImportJobLogPath(jobId);
  if (!file) return null;
  try {
    return await readFile(file, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function persistedJobLogLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}
