import { Path } from "@core/path";
import { isActivePlanStatus } from "@core/types/planCommon";
import type { RecognizeMediaFilePlan } from "@smm/core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import type { FsPort } from "../ports/FsPort";
import { planFilePath, plansDir } from "./paths";

export type Plan = RecognizeMediaFilePlan | RenameFilesPlan;

export interface ListPlansOptions {
  mediaFolderPath?: string;
  /** When true, include `rejected` plans in addition to active ones. */
  all?: boolean;
}

export async function writePlan(fs: FsPort, appDataDir: string, plan: Plan): Promise<void> {
  await fs.writeTextFile(planFilePath(appDataDir, plan.id), JSON.stringify(plan, null, 2));
}

export async function readPlan(
  fs: FsPort,
  appDataDir: string,
  id: string,
): Promise<Plan | null> {
  const path = planFilePath(appDataDir, id);
  if (!(await fs.exists(path))) return null;
  try {
    return JSON.parse(await fs.readTextFile(path)) as Plan;
  } catch {
    return null;
  }
}

export async function deletePlan(fs: FsPort, appDataDir: string, id: string): Promise<void> {
  await fs.deleteFile(planFilePath(appDataDir, id));
}

function isPlanFilePath(path: string): boolean {
  return path.endsWith(".plan.json");
}

/**
 * List plan files under `{appDataDir}/plans`.
 * Default: active (`preparing` / `pending`) only.
 * `all: true` also includes `rejected` (completed plans are deleted).
 */
export async function listPlans(
  fs: FsPort,
  appDataDir: string,
  options: ListPlansOptions = {},
): Promise<Plan[]> {
  const dir = plansDir(appDataDir);
  let files: string[];
  try {
    files = await fs.listFiles(dir);
  } catch {
    return [];
  }

  const target =
    options.mediaFolderPath !== undefined ? Path.posix(options.mediaFolderPath) : undefined;
  const includeRejected = options.all === true;
  const plans: Plan[] = [];

  for (const file of files) {
    const posixFile = Path.posix(file);
    if (!isPlanFilePath(posixFile)) continue;
    let plan: Plan | null = null;
    try {
      plan = JSON.parse(await fs.readTextFile(posixFile)) as Plan;
    } catch {
      continue;
    }
    if (!plan || typeof plan !== "object" || !("status" in plan)) continue;

    const folder = Path.posix(plan.mediaFolderPath);
    if (target !== undefined && folder !== target) continue;

    const active = isActivePlanStatus(plan.status);
    if (!active && !(includeRejected && plan.status === "rejected")) continue;

    plans.push({ ...plan, mediaFolderPath: folder });
  }

  return plans;
}

/** Mark a plan as rejected and keep the file on disk. */
export async function rejectPlan(fs: FsPort, appDataDir: string, id: string): Promise<Plan> {
  const existing = await readPlan(fs, appDataDir, id);
  if (!existing) {
    throw new Error(`Plan not found: ${id}`);
  }
  const rejected: Plan = { ...existing, status: "rejected" };
  await writePlan(fs, appDataDir, rejected);
  return rejected;
}
