import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
import type { ApplyPlanDeps } from "./applyPlan";
import { applyRenameFilesPlanPipeline } from "./applyRenameFilesPlan";
import { createRenameEpisodePlanPipeline } from "./createRenameEpisodePlan";
import { mediaFilePathEqual } from "./mediaFilePathEqual";
import { rejectPlan } from "./plans";

export class SelectedFilesNotInPlanError extends Error {
  readonly files: string[];

  constructor(files: string[]) {
    super(`Files not in plan: ${files.join(", ")}`);
    this.name = "SelectedFilesNotInPlanError";
    this.files = files;
  }
}

/**
 * UC3: apply only the selected "from" files of a pending rename plan.
 * Rejects the original plan (kept on disk), creates a subset plan, applies it.
 */
export async function applySelectedRenameFilesPlanPipeline(
  plan: RenameFilesPlan,
  selectedFiles: string[],
  deps: ApplyPlanDeps,
): Promise<void> {
  if (plan.task !== "rename-files") {
    throw new Error(`Unsupported plan task: ${plan.task}`);
  }
  if (selectedFiles.length === 0) {
    throw new Error("data.files must be a non-empty array");
  }

  // Normalize Windows separators first: mediaFilePathEqual's Path.posix
  // fallback can't parse paths like "\m\Show\old1.mkv" (no drive letter).
  const toPosix = (p: string) => p.replaceAll("\\", "/");

  const offenders = selectedFiles.filter(
    (file) => !plan.files.some((entry) => mediaFilePathEqual(entry.from, toPosix(file))),
  );
  if (offenders.length > 0) {
    throw new SelectedFilesNotInPlanError(offenders);
  }

  const filtered = plan.files.filter((entry) =>
    selectedFiles.some((file) => mediaFilePathEqual(entry.from, toPosix(file))),
  );

  await rejectPlan(deps.fs, deps.appDataDir, plan.id);
  const newPlan = await createRenameEpisodePlanPipeline(
    plan.mediaFolderPath,
    filtered,
    { creator: plan.creator },
    deps,
  );
  await applyRenameFilesPlanPipeline(newPlan, deps);
}
