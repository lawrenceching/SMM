import type { RecognizeMediaFilePlan } from "@smm/core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import type { FsPort } from "../ports/FsPort";
import { planFilePath } from "./paths";

export type Plan = RecognizeMediaFilePlan | RenameFilesPlan;

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
