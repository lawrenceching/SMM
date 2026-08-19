import { Path } from "@core/path";
import {
  extensions,
  imageFileExtensions,
  subtitleFileExtensions,
} from "@core/utils";
import { basename, extname } from "./paths";

export function findAssociatedFiles(
  mediaFolderPath: string,
  filePaths: string[],
  videoFilePath: string,
): string[] {
  const normalizedVideoPath = Path.posix(videoFilePath);
  const normalizedFilePaths = filePaths.map((p) => Path.posix(p));

  const filename = basename(normalizedVideoPath);
  const extension = extname(filename);
  const filenameWithoutExtension = filename.replace(extension, "");

  const findFiles = (extensionsList: string[]) => {
    const possibleFileNames = extensionsList.map(
      (ext) => `${filenameWithoutExtension}${ext}`,
    );
    return normalizedFilePaths
      .filter((filePath) =>
        extensionsList.some((ext) => filePath.endsWith(ext)),
      )
      .filter((filePath) => {
        const name = basename(filePath);
        if (possibleFileNames.includes(name)) return true;
        if (name.startsWith(filenameWithoutExtension + ".")) {
          return extensionsList.some((ext) => name.endsWith(ext));
        }
        return false;
      })
      .map((filePath) => Path.posix(filePath));
  };

  return [
    ...findFiles(imageFileExtensions),
    ...findFiles(subtitleFileExtensions),
    ...findFiles(extensions.audioTrackFileExtensions),
    ...findFiles([".nfo"]),
  ];
}
