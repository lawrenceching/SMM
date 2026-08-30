import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import { Path } from "@core/path";
import { getFullExtensionForAssociatedFile } from "@core/utils";
import { findAssociatedFiles } from "./findAssociatedFiles";
import { extname, joinPosix } from "./paths";

export function buildTvShowRenameListForPlan(options: {
  mediaFolderPath: string;
  localFiles: string[];
  plan: RenameFilesPlan;
}): Array<{ from: string; to: string }> {
  const mediaFolderPath = Path.posix(options.mediaFolderPath);
  const localFiles = options.localFiles.map((p) => Path.posix(p));
  const { plan } = options;

  const renameList: Array<{ from: string; to: string }> = [];
  renameList.push(...plan.files);

  for (const file of plan.files) {
    const { from, to } = file;

    const newFileRelativePath = to.replace(mediaFolderPath, "");
    const newFileRelativePathWithExt = newFileRelativePath.replace(
      extname(newFileRelativePath),
      "",
    );

    const associatedFiles = findAssociatedFiles(
      mediaFolderPath,
      localFiles,
      from,
    );

    for (const associatedFile of associatedFiles) {
      const fullExt = getFullExtensionForAssociatedFile(associatedFile);
      const fromA = Path.posix(associatedFile);
      const relativeDest = (newFileRelativePathWithExt + fullExt).replace(
        /^\//,
        "",
      );
      const toA = Path.posix(joinPosix(mediaFolderPath, relativeDest));

      renameList.push({ from: fromA, to: toA });
    }
  }

  return renameList;
}
