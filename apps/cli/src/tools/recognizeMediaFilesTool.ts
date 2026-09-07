import { broadcast } from "../utils/socketIO";
import { RecognizeMediaFilePlanReady, type RecognizeMediaFilePlanReadyRequestData } from "@smm/types/event-types";
import type { RecognizeMediaFilePlan, RecognizedFile } from "@smm/types/RecognizeMediaFilePlan";
import { getAppDataDir } from "@/utils/config";
import path from "path";
import { mkdir } from "fs/promises";
import { Path } from "@smm/utils/path";


/**
 * Get the path to the plans directory
 */
function getPlansDir(): string {
  return path.join(getAppDataDir(), 'plans');
}

/**
 * Get the path to a plan file by task ID
 */
function getPlanFilePath(taskId: string): string {
  const plansDir = getPlansDir();
  return path.join(plansDir, `${taskId}.plan.json`);
}

/**
 * Ensure the plans directory exists
 */
async function ensurePlansDirExists(): Promise<void> {
  const plansDir = getPlansDir();
  await mkdir(plansDir, { recursive: true });
}

/**
 * Read a plan file from disk
 */
async function readPlanFile(taskId: string): Promise<RecognizeMediaFilePlan | null> {
  const planFilePath = getPlanFilePath(taskId);
  const file = Bun.file(planFilePath);
  
  if (!(await file.exists())) {
    return null;
  }
  
  try {
    const content = await file.json();
    return content as RecognizeMediaFilePlan;
  } catch (error) {
    throw new Error(`Failed to read plan file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Begin a recognition task
 * @param mediaFolderPath The absolute path of the media folder, in POSIX format
 * @return The task ID
 */
export async function beginRecognizeTask(mediaFolderPath: string): Promise<string> {
  const planId = crypto.randomUUID();
  const folderPathInPosix = Path.posix(mediaFolderPath);
  
  const plan: RecognizeMediaFilePlan = {
    id: planId,
    task: "recognize-media-file",
    status: "pending",
    creator: "ai",
    mediaFolderPath: folderPathInPosix,
    files: [],
  };
  
  await ensurePlansDirExists();
  const planFilePath = getPlanFilePath(planId);
  await Bun.write(planFilePath, JSON.stringify(plan, null, 2));
  
  return planId;
}

/**
 * Validate that a recognized file path points to a regular file on
 * disk. Throws on the first missing path so callers (AI tools,
 * legacy CLI) get a clear error before queueing a non-existent file
 * for the user to confirm later.
 */
async function assertRecognizedFileExists(file: RecognizedFile): Promise<void> {
  if (!file.path) {
    throw new Error(`File path is empty for S${file.season}E${file.episode}`);
  }
  const filePathInPosix = Path.posix(file.path);
  const platformPath = Path.toPlatformPath(filePathInPosix);
  const exists = await Bun.file(platformPath).exists();
  if (!exists) {
    throw new Error(
      `File "${filePathInPosix}" (S${file.season}E${file.episode}) does not exist in the media folder`,
    );
  }
}

export async function addRecognizedMediaFile(taskId: string, file: RecognizedFile): Promise<void> {
  const plan = await readPlanFile(taskId);

  if (!plan) {
    throw new Error(`Task with id ${taskId} not found`);
  }

  // Ensure path is in POSIX format
  const filePathInPosix = Path.posix(file.path);

  // Reject non-existent files before adding them to the plan so the
  // AI cannot silently queue up a path the user has to unwind at
  // confirmation time.
  await assertRecognizedFileExists({ ...file, path: filePathInPosix });

  plan.files.push({
    season: file.season,
    episode: file.episode,
    path: filePathInPosix,
  });

  const planFilePath = getPlanFilePath(taskId);
  await Bun.write(planFilePath, JSON.stringify(plan, null, 2));
}

/**
 * Get a task by ID
 * @param taskId The task ID
 * @return The task plan or undefined if not found
 */
export async function getTask(taskId: string): Promise<RecognizeMediaFilePlan | undefined> {
  const plan = await readPlanFile(taskId);
  return plan || undefined;
}

/**
 * End a recognition task and notify the UI
 * @param taskId The task ID
 */
export async function endRecognizeTask(taskId: string): Promise<void> {
  const plan = await readPlanFile(taskId);
  
  if (!plan) {
    throw new Error(`Task with id ${taskId} not found`);
  }
  
  const planFilePath = getPlanFilePath(taskId);
  const planFilePathInPosix = Path.posix(planFilePath);
  
  const data: RecognizeMediaFilePlanReadyRequestData = {
    taskId,
    planFilePath: planFilePathInPosix,
  };
  
  broadcast({
    event: RecognizeMediaFilePlanReady.event,
    data,
  });
}


