import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
import { Path } from "@smm/utils/path";
import type { ApplyPlanDeps } from "./applyPlan";
import { buildTvShowRenameListForPlan } from "./buildTvShowRenameListForPlan";
import { mediaFilePathEqual } from "./mediaFilePathEqual";
import { deletePlan } from "./plans";

function dirnamePosix(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

/** Applies a pending rename-files plan: disk rename, mediaFiles rewrite, delete plan. */
export async function applyRenameFilesPlanPipeline(
  plan: RenameFilesPlan,
  deps: ApplyPlanDeps,
): Promise<void> {
  if (plan.task !== "rename-files") {
    throw new Error(`Unsupported plan task: ${plan.task}`);
  }

  const folder = deps.normalizePosix(plan.mediaFolderPath);
  const mm = await deps.getMediaMetadata(folder);
  if (!mm) {
    throw new Error(`Media metadata not found: ${plan.mediaFolderPath}`);
  }

  if (plan.files.length === 0) {
    await deletePlan(deps.fs, deps.appDataDir, plan.id);
    return;
  }

  const localFiles = (await deps.fs.listFiles(folder)).map((p) => Path.posix(p));
  const renameList = buildTvShowRenameListForPlan({
    mediaFolderPath: folder,
    localFiles,
    plan,
  });

  for (const { from, to } of renameList) {
    const parent = dirnamePosix(Path.posix(to));
    await deps.fs.mkdir(parent);
    await deps.fs.rename(from, to);
  }

  let mediaFiles = mm.mediaFiles ?? [];
  for (const { from, to } of renameList) {
    mediaFiles = mediaFiles.map((entry) =>
      mediaFilePathEqual(entry.absolutePath, from)
        ? { ...entry, absolutePath: Path.posix(to) }
        : entry,
    );
  }

  await deps.setMetadata({ ...mm, mediaFiles });
  await deletePlan(deps.fs, deps.appDataDir, plan.id);
}
