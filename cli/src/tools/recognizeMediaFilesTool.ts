import { broadcast } from "../utils/socketIO";
import { RecognizeMediaFilePlanReady, type RecognizeMediaFilePlanReadyRequestData } from "@core/event-types";
import type { RecognizeMediaFilePlan, RecognizedFile } from "@core/types/RecognizeMediaFilePlan";
import { getUserDataDir } from "@/utils/config";
import path from "path";
import { mkdir, readdir, stat } from "fs/promises";
import { Path } from "@core/path";
import pino from "pino";

const logger = pino();

/**
 * Get the path to the plans directory
 */
function getPlansDir(): string {
  const userDataDir = getUserDataDir();
  return path.join(userDataDir, 'plans');
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
  const taskId = crypto.randomUUID();
  const folderPathInPosix = Path.posix(mediaFolderPath);
  
  const plan: RecognizeMediaFilePlan = {
    task: "recognize-media-file",
    status: "pending",
    mediaFolderPath: folderPathInPosix,
    files: [],
  };
  
  await ensurePlansDirExists();
  const planFilePath = getPlanFilePath(taskId);
  await Bun.write(planFilePath, JSON.stringify(plan, null, 2));
  
  return taskId;
}

/**
 * Add a recognized file to a task
 * @param taskId The task ID
 * @param file The recognized file information
 */
export async function addRecognizedMediaFile(taskId: string, file: RecognizedFile): Promise<void> {
  const plan = await readPlanFile(taskId);
  
  if (!plan) {
    throw new Error(`Task with id ${taskId} not found`);
  }
  
  // Ensure path is in POSIX format
  const filePathInPosix = Path.posix(file.path);
  
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

/**
 * Get all pending tasks from the plans directory
 * @return Array of pending RecognizeMediaFilePlan tasks
 */
export async function getAllPendingTasks(): Promise<RecognizeMediaFilePlan[]> {
  const plansDir = getPlansDir();
  const pendingTasks: RecognizeMediaFilePlan[] = [];

  try {
    // Check if plans directory exists
    try {
      const stats = await stat(plansDir);
      if (!stats.isDirectory()) {
        logger.warn({ plansDir }, 'Plans path exists but is not a directory');
        return [];
      }
    } catch (error) {
      // Directory doesn't exist, return empty array
      return [];
    }

    // Read all files in the plans directory
    const files = await readdir(plansDir);

    // Filter for .plan.json files and parse them
    for (const file of files) {
      if (!file.endsWith('.plan.json')) {
        continue;
      }

      const planFilePath = path.join(plansDir, file);

      try {
        const fileContent = Bun.file(planFilePath);
        
        if (!(await fileContent.exists())) {
          continue;
        }

        const content = await fileContent.json();
        
        // Validate that it's a RecognizeMediaFilePlan with pending status
        if (
          typeof content === 'object' &&
          content !== null &&
          content.task === 'recognize-media-file' &&
          content.status === 'pending'
        ) {
          pendingTasks.push(content as RecognizeMediaFilePlan);
        }
      } catch (error) {
        // Log warning for invalid JSON files but continue processing others
        logger.warn(
          { planFilePath, error: error instanceof Error ? error.message : String(error) },
          'Failed to parse plan file, skipping'
        );
      }
    }

    return pendingTasks;
  } catch (error) {
    logger.error(
      { plansDir, error: error instanceof Error ? error.message : String(error) },
      'Failed to read plans directory'
    );
    // Return empty array on error rather than throwing
    return [];
  }
}
