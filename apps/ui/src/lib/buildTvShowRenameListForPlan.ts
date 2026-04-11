import { basename, extname, join } from "@/lib/path";
import { findAssociatedFiles } from "@/lib/utils";
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan";
import { ext } from "@core/path";
import { subtitleFileExtensions } from "@core/utils";
import Debug from "debug";

const debug = Debug("buildTvShowRenameListForPlan");

/**
 * Full rename list for a TV show rename plan (video rows + associated subtitles/nfo/etc.),
 * same ordering as {@link applyRenameFilesPlanForTvShow} sends to the API.
 */
export function buildTvShowRenameListForPlan(options: {
  mediaFolderPath: string;
  localFiles: string[];
  plan: UIRenameFilesPlan;
  traceId?: string;
}): Array<{ from: string; to: string }> {
  const { mediaFolderPath, localFiles, plan, traceId } = options;
  const logPrefix = traceId ? `[${traceId}] ` : "";

  const renameList: Array<{ from: string; to: string }> = [];
  renameList.push(...plan.files);

  for (const file of plan.files) {
    const { from, to } = file;

    const newFileRelativePath = to.replace(mediaFolderPath, "");
    const newFileRelativePathWithExt = newFileRelativePath.replace(
      extname(newFileRelativePath),
      ""
    );

    const associatedFiles = findAssociatedFiles(mediaFolderPath, localFiles, from)
      .map((f) => f.path)
      .map((relativePath) => join(mediaFolderPath, relativePath));

    const renameListForAssoFiles: Array<{ from: string; to: string }> = [];
    for (const associatedFile of associatedFiles) {
      let _ext = extname(associatedFile);
      const fromA = associatedFile;

      if (subtitleFileExtensions.includes(_ext)) {
        const filename = basename(associatedFile);
        if (filename === undefined) {
          throw new Error(`basename of ${associatedFile} is undefined`);
        }
        const parts = filename.split(".");
        if (parts.length > 2) {
          _ext = ext(filename, 2);
        }
      }

      const toA = join(mediaFolderPath, newFileRelativePathWithExt + _ext);

      renameListForAssoFiles.push({ from: fromA, to: toA });
    }

    debug(`${logPrefix}rename list for associated files: ${JSON.stringify(renameListForAssoFiles)}`);
    renameList.push(...renameListForAssoFiles);
  }

  return renameList;
}
