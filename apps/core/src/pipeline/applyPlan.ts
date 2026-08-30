import type { MediaMetadata } from "@smm/types";
import type { FsPort } from "../ports/FsPort";
import { applyRenameFilesPlanPipeline } from "./applyRenameFilesPlan";
import { deletePlan, type Plan } from "./plans";
import { updateMediaFileMetadatas } from "./updateMediaFileMetadatas";

export interface ApplyPlanDeps {
  fs: FsPort;
  appDataDir: string;
  normalizePosix: (path: string) => string;
  getMediaMetadata: (folder: string) => Promise<MediaMetadata | null>;
  setMetadata: (mm: MediaMetadata) => Promise<void>;
}

/** Dispatches apply by plan task (recognize-media-file or rename-files). */
export async function applyPlanPipeline(plan: Plan, deps: ApplyPlanDeps): Promise<void> {
  const task = plan.task;
  if (task === "recognize-media-file") {
    return applyRecognizeMediaFilePlanPipeline(plan, deps);
  }
  if (task === "rename-files") {
    return applyRenameFilesPlanPipeline(plan, deps);
  }
  throw new Error(`Unsupported plan task: ${task}`);
}

/** Applies a pending recognize-media-file plan: merge mediaFiles, persist, delete plan. */
export async function applyRecognizeMediaFilePlanPipeline(
  plan: Plan,
  deps: ApplyPlanDeps,
): Promise<void> {
  if (plan.task !== "recognize-media-file") {
    throw new Error(`Unsupported plan task: ${plan.task}`);
  }

  const folder = deps.normalizePosix(plan.mediaFolderPath);
  const mm = await deps.getMediaMetadata(folder);
  if (!mm) {
    throw new Error(`Media metadata not found: ${plan.mediaFolderPath}`);
  }

  let mediaFiles = mm.mediaFiles ?? [];
  for (const file of plan.files) {
    mediaFiles = updateMediaFileMetadatas(mediaFiles, file.path, file.season, file.episode);
  }

  await deps.setMetadata({ ...mm, mediaFiles });
  await deletePlan(deps.fs, deps.appDataDir, plan.id);
}
