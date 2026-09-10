import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import type { ApplyPlanDeps } from "./applyPlan";
import { mediaFilePathEqual } from "./mediaFilePathEqual";
import { updateMediaFileMetadatas } from "./updateMediaFileMetadatas";
import { deletePlan } from "./plans";

export class RecognizedFilesNotInPlanError extends Error {
  readonly files: string[];

  constructor(files: string[]) {
    super(`Files not in plan: ${files.join(", ")}`);
    this.name = "RecognizedFilesNotInPlanError";
    this.files = files;
  }
}

/**
 * Apply only the selected files of a pending recognize-media-file plan:
 * validate membership, merge the filtered entries into metadata, delete the plan.
 */
export async function applySelectedRecognizeFilesPlanPipeline(
  plan: RecognizeMediaFilePlan,
  selectedFiles: string[],
  deps: ApplyPlanDeps,
): Promise<void> {
  if (plan.task !== "recognize-media-file") {
    throw new Error(`Unsupported plan task: ${plan.task}`);
  }
  if (selectedFiles.length === 0) {
    throw new Error("data.files must be a non-empty array");
  }

  // Normalize Windows separators first: mediaFilePathEqual's Path.posix
  // fallback can't parse paths like "\m\Show\ep1.mkv" (no drive letter).
  const toPosix = (p: string) => p.replaceAll("\\", "/");

  const offenders = selectedFiles.filter(
    (file) => !plan.files.some((entry) => mediaFilePathEqual(entry.path, toPosix(file))),
  );
  if (offenders.length > 0) {
    throw new RecognizedFilesNotInPlanError(offenders);
  }

  const filtered = plan.files.filter((entry) =>
    selectedFiles.some((file) => mediaFilePathEqual(entry.path, toPosix(file))),
  );

  const folder = deps.normalizePosix(plan.mediaFolderPath);
  const mm = await deps.getMediaMetadata(folder);
  if (!mm) {
    throw new Error(`Media metadata not found: ${plan.mediaFolderPath}`);
  }

  let mediaFiles = mm.mediaFiles ?? [];
  for (const file of filtered) {
    mediaFiles = updateMediaFileMetadatas(mediaFiles, file.path, file.season, file.episode);
  }

  await deps.setMetadata({ ...mm, mediaFiles });
  await deletePlan(deps.fs, deps.appDataDir, plan.id);
}
