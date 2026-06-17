import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Path } from "@smm/core/path";
import type {
  RecognizeMediaFilePlan,
  RecognizedFile,
} from "@smm/core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import {
  createEmptyRenamePlan,
  prepareAppendRenameEntry,
  type PrepareAppendRenameEntryDeps,
} from "@smm/core/plan/renamePlan";
import type { ChatFs } from "../chatTypes.ts";

/**
 * Plan-file storage helpers shared by the `rename-files-task` and
 * `recognize-media-file-task` agent tools. Plans live in
 * `{appDataDir}/plans/*.plan.json` and are written via the
 * runtime-neutral {@link ChatFs} abstraction so the same code works
 * for both Node (OHOS) and Bun (cli).
 */
export function plansDir(appDataDir: string): string {
  return path.join(appDataDir, "plans");
}

export function planFilePath(appDataDir: string, planId: string): string {
  return path.join(plansDir(appDataDir), `${planId}.plan.json`);
}

async function ensurePlansDirExists(
  appDataDir: string,
  fs: ChatFs,
): Promise<void> {
  const dir = plansDir(appDataDir);
  try {
    const stats = await stat(dir);
    if (!stats.isDirectory()) {
      throw new Error("Plans path exists but is not a directory");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dir, { recursive: true });
      return;
    }
    throw error;
  }
}

// ─── Rename-files plan ───────────────────────────────────────────

export interface RenamePlanAppendDeps {
  validateOperations: PrepareAppendRenameEntryDeps["validateOperations"];
  getMediaMetadata: PrepareAppendRenameEntryDeps["getMediaMetadata"];
}

/**
 * Begin a rename-files task: create an empty plan file and return
 * the new plan id.
 */
export async function beginRenamePlan(
  appDataDir: string,
  mediaFolderPath: string,
  fs: ChatFs,
): Promise<string> {
  await ensurePlansDirExists(appDataDir, fs);
  const plan = createEmptyRenamePlan(Path.posix(mediaFolderPath));
  await fs.writeJson(planFilePath(appDataDir, plan.id), plan);
  return plan.id;
}

/**
 * Append a rename entry to an existing plan. Throws if the plan is
 * missing or validation fails.
 */
export async function appendRenamePlanEntry(
  appDataDir: string,
  planId: string,
  from: string,
  to: string,
  fs: ChatFs,
  deps: RenamePlanAppendDeps,
): Promise<void> {
  const filePath = planFilePath(appDataDir, planId);
  const plan = (await fs.readJson<RenameFilesPlan>(filePath)) ?? null;
  if (!plan) {
    throw new Error(`Task with id ${planId} not found`);
  }

  const result = await prepareAppendRenameEntry(
    plan,
    { from, to },
    deps,
  );

  if ("error" in result) {
    throw new Error(result.error.replace(/^Error Reason: /, ""));
  }

  await fs.writeJson(filePath, result);
}

/**
 * Read a rename plan by id. Returns `null` if the file does not
 * exist.
 */
export async function readRenamePlan(
  appDataDir: string,
  planId: string,
  fs: ChatFs,
): Promise<RenameFilesPlan | null> {
  return fs.readJson<RenameFilesPlan>(planFilePath(appDataDir, planId));
}

// ─── Recognize-media-file plan ───────────────────────────────────

/**
 * Begin a recognition task: create an empty plan file and return the
 * new plan id.
 */
export async function beginRecognizePlan(
  appDataDir: string,
  mediaFolderPath: string,
  fs: ChatFs,
): Promise<string> {
  await ensurePlansDirExists(appDataDir, fs);
  const planId = randomUUID();
  const plan: RecognizeMediaFilePlan = {
    id: planId,
    task: "recognize-media-file",
    status: "pending",
    mediaFolderPath: Path.posix(mediaFolderPath),
    files: [],
  };
  await fs.writeJson(planFilePath(appDataDir, planId), plan);
  return planId;
}

export async function appendRecognizedFile(
  appDataDir: string,
  taskId: string,
  file: RecognizedFile,
  fs: ChatFs,
): Promise<void> {
  const filePath = planFilePath(appDataDir, taskId);
  const plan = (await fs.readJson<RecognizeMediaFilePlan>(filePath)) ?? null;
  if (!plan) {
    throw new Error(`Task with id ${taskId} not found`);
  }

  plan.files.push({
    season: file.season,
    episode: file.episode,
    path: Path.posix(file.path),
  });

  await fs.writeJson(filePath, plan);
}

export async function readRecognizePlan(
  appDataDir: string,
  taskId: string,
  fs: ChatFs,
): Promise<RecognizeMediaFilePlan | null> {
  return fs.readJson<RecognizeMediaFilePlan>(planFilePath(appDataDir, taskId));
}

// ─── Generic plan helpers (shared) ───────────────────────────────

/**
 * Iterate over all `*.plan.json` files in the plans dir. Returns the
 * full paths. Used by status-update operations.
 */
export async function listPlanFiles(
  appDataDir: string,
): Promise<string[]> {
  const dir = plansDir(appDataDir);
  try {
    const stats = await stat(dir);
    if (!stats.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }
  const files = await readdir(dir);
  return files
    .filter((file) => file.endsWith(".plan.json"))
    .map((file) => path.join(dir, file));
}
