import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Path } from "@smm/core/path";
import type {
  RecognizeMediaFilePlan,
  RecognizedFile,
} from "@smm/core/types/RecognizeMediaFilePlan";
import type { RenameFileEntry, RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import type { PlanCreator, PlanStatus } from "@smm/core/types/planCommon";
import { isActivePlanStatus } from "@smm/core/types/planCommon";
import { PLAN_CANCELLED_BY_USER_MESSAGE } from "@smm/core/types/ai-tools/planTaskMessages";
import {
  createEmptyRenamePlan,
  prepareAppendRenameEntry,
  type PrepareAppendRenameEntryDeps,
} from "@smm/core/plan/renamePlan";
import type { ChatFs } from "../chatTypes.ts";

export type AnyPlan = RecognizeMediaFilePlan | RenameFilesPlan;

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
 *
 * AI/MCP-created plans start as `preparing` with `creator: "ai"`; the
 * end-task tool flips them to `pending` once entries are added.
 */
export async function beginRenamePlan(
  appDataDir: string,
  mediaFolderPath: string,
  fs: ChatFs,
): Promise<string> {
  await ensurePlansDirExists(appDataDir, fs);
  const plan = createEmptyRenamePlan(Path.posix(mediaFolderPath), undefined, {
    creator: "ai",
    status: "preparing",
  });
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

  if (plan.status === "rejected") {
    throw new Error(PLAN_CANCELLED_BY_USER_MESSAGE);
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
  const plan = await readPlanById(appDataDir, planId, fs);
  if (!plan || plan.task !== "rename-files") {
    return null;
  }
  return plan as RenameFilesPlan;
}

/**
 * Read any plan file by id. Returns `null` when the file does not
 * exist.
 */
export async function readPlanById(
  appDataDir: string,
  planId: string,
  fs: ChatFs,
): Promise<AnyPlan | null> {
  const plan = await fs.readJson<AnyPlan>(planFilePath(appDataDir, planId));
  if (!plan) {
    return null;
  }
  return normalizePlanPaths(withCreatorDefault(plan));
}

// ─── Recognize-media-file plan ───────────────────────────────────

/**
 * Begin a recognition task: create an empty plan file and return the
 * new plan id.
 *
 * AI/MCP-created plans start as `preparing` with `creator: "ai"`; the
 * end-task tool flips them to `pending` once files are added.
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
    status: "preparing",
    creator: "ai",
    mediaFolderPath: Path.posix(mediaFolderPath),
    files: [],
  };
  await fs.writeJson(planFilePath(appDataDir, planId), plan);
  return planId;
}

export interface RecognizePlanAppendDeps {
  /**
   * Filesystem-existence check for the path being added. Defaults to
   * a runtime-neutral {@link ChatFs.exists} probe when omitted. The
   * legacy CLI used Bun's `Bun.file(...).exists()`; both backends
   * behave identically for the "regular file exists" question this
   * tool needs to answer.
   */
  validateFiles?: (files: RecognizedFile[]) => Promise<void>;
}

/**
 * Validate that every recognized file path points to a regular file
 * on disk. Throws on the first missing path with a descriptive
 * message. Uses {@link ChatFs.exists} so the same code runs on both
 * Bun (`apps/cli`) and Node (`apps/ohos`).
 */
export async function defaultValidateRecognizedFiles(
  files: RecognizedFile[],
  fs: ChatFs,
): Promise<void> {
  for (const file of files) {
    if (!file.path) {
      throw new Error(
        `File path is empty for S${file.season}E${file.episode}`,
      );
    }
    const platformPath = Path.toPlatformPath(Path.posix(file.path));
    const exists = await fs.exists(platformPath);
    if (!exists) {
      throw new Error(
        `File "${Path.posix(file.path)}" (S${file.season}E${file.episode}) does not exist in the media folder`,
      );
    }
  }
}

export async function appendRecognizedFile(
  appDataDir: string,
  taskId: string,
  file: RecognizedFile,
  fs: ChatFs,
  deps: RecognizePlanAppendDeps = {},
): Promise<void> {
  const filePath = planFilePath(appDataDir, taskId);
  const plan = (await fs.readJson<RecognizeMediaFilePlan>(filePath)) ?? null;
  if (!plan) {
    throw new Error(`Task with id ${taskId} not found`);
  }

  if (plan.status === "rejected") {
    throw new Error(PLAN_CANCELLED_BY_USER_MESSAGE);
  }

  const normalizedPath = Path.posix(file.path);
  const validate =
    deps.validateFiles ??
    ((files) => defaultValidateRecognizedFiles(files, fs));
  await validate([{ ...file, path: normalizedPath }]);

  plan.files.push({
    season: file.season,
    episode: file.episode,
    path: normalizedPath,
  });

  await fs.writeJson(filePath, plan);
}

export async function readRecognizePlan(
  appDataDir: string,
  taskId: string,
  fs: ChatFs,
): Promise<RecognizeMediaFilePlan | null> {
  const plan = await readPlanById(appDataDir, taskId, fs);
  if (!plan || plan.task !== "recognize-media-file") {
    return null;
  }
  return plan as RecognizeMediaFilePlan;
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

// ─── Unified plan CRUD (HTTP getPlans / createPlan / updatePlan) ──

/**
 * Backfill `creator` for plan files written before the field existed.
 * Legacy plans are treated as app-created.
 */
function withCreatorDefault<T extends AnyPlan>(plan: T): T {
  if ((plan as { creator?: PlanCreator }).creator) {
    return plan;
  }
  return { ...plan, creator: "app" as PlanCreator };
}

function normalizePlanPaths(plan: AnyPlan): AnyPlan {
  const mediaFolderPath = Path.posix(plan.mediaFolderPath);
  if (plan.task === "recognize-media-file") {
    return {
      ...plan,
      mediaFolderPath,
      files: plan.files.map((f) => ({ ...f, path: Path.posix(f.path) })),
    };
  }
  return {
    ...plan,
    mediaFolderPath,
    files: plan.files.map((f) => ({
      from: Path.posix(f.from),
      to: Path.posix(f.to),
    })),
  };
}

export interface CreatePlanInput {
  /** Optional client-supplied UUID so the caller can reference the plan immediately. */
  id?: string;
  task: "recognize-media-file" | "rename-files";
  mediaFolderPath: string;
  creator: PlanCreator;
}

/**
 * Create a new plan file in `preparing` status with no entries.
 */
export async function createPlan(
  appDataDir: string,
  input: CreatePlanInput,
  fs: ChatFs,
): Promise<AnyPlan> {
  await ensurePlansDirExists(appDataDir, fs);
  const id = input.id ?? randomUUID();
  const mediaFolderPath = Path.posix(input.mediaFolderPath);
  const plan: AnyPlan =
    input.task === "recognize-media-file"
      ? {
          id,
          task: "recognize-media-file",
          status: "preparing",
          creator: input.creator,
          mediaFolderPath,
          files: [],
        }
      : {
          id,
          task: "rename-files",
          status: "preparing",
          creator: input.creator,
          mediaFolderPath,
          files: [],
        };
  await fs.writeJson(planFilePath(appDataDir, id), plan);
  return plan;
}

export interface UpdatePlanPatch {
  status?: PlanStatus;
  files?: RecognizedFile[] | RenameFileEntry[];
}

/**
 * Patch a plan's `status` and/or `files`.
 *
 * Behaviour at terminal statuses:
 * - `completed` (user confirmed and applied): delete the plan file.
 * - `rejected` (user cancelled, possibly mid-`preparing`): keep the
 *   plan file with `status: "rejected"` so that a still-in-flight AI
 *   workflow calling `add-*-file` or `end-*-task` afterwards can detect
 *   the cancellation and return a clear message instead of silently
 *   queueing entries into a deleted plan.
 *
 * Returns `null` if the plan file does not exist.
 */
export async function updatePlanContent(
  appDataDir: string,
  id: string,
  patch: UpdatePlanPatch,
  fs: ChatFs,
): Promise<AnyPlan | null> {
  const filePath = planFilePath(appDataDir, id);
  const existing = await fs.readJson<AnyPlan>(filePath);
  if (!existing) {
    return null;
  }

  const merged = withCreatorDefault({
    ...existing,
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.files !== undefined ? { files: patch.files } : {}),
  } as AnyPlan);
  const updated = normalizePlanPaths(merged);

  if (patch.status === "completed") {
    await deletePlan(appDataDir, id);
    return updated;
  }

  await fs.writeJson(filePath, updated);
  return updated;
}

/**
 * Delete a plan file by id. No-op if the file does not exist.
 */
export async function deletePlan(
  appDataDir: string,
  id: string,
): Promise<void> {
  try {
    await unlink(planFilePath(appDataDir, id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Return all active (`preparing`/`pending`) plans for a media folder.
 * Terminal plans are ignored. Legacy plans without `creator` are
 * treated as app-created.
 */
export async function getActivePlansForFolder(
  appDataDir: string,
  mediaFolderPath: string,
  fs: ChatFs,
): Promise<AnyPlan[]> {
  const target = Path.posix(mediaFolderPath);
  const files = await listPlanFiles(appDataDir);
  const plans: AnyPlan[] = [];
  for (const file of files) {
    const plan = await fs.readJson<AnyPlan>(file);
    if (!plan) {
      continue;
    }
    const normalized = normalizePlanPaths(withCreatorDefault(plan));
    if (
      normalized.mediaFolderPath === target &&
      isActivePlanStatus(normalized.status)
    ) {
      plans.push(normalized);
    }
  }
  return plans;
}
