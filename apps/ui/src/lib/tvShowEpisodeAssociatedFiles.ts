import { findAssociatedFiles } from "@smm/core/pipeline/findAssociatedFiles";
import { imageFileExtensions, subtitleFileExtensions } from "@smm/types/mediaFileExtensions";
import { extname } from "@/lib/path";

/** Exact stem match: S01E01.mkv → S01E01.jpg */
export function findThumbnails(files: string[], videoFile: string): string[] {
  const videoFileExt = extname(videoFile);
  const possibleThumbnailFilePaths = imageFileExtensions.map(
    (ext) => `${videoFile.replace(videoFileExt, ext)}`,
  );
  return files.filter((file) => possibleThumbnailFilePaths.includes(file));
}

/**
 * Subtitles for a video: exact stem (S01E01.ass) or language-tagged
 * (S01E01.sc.ass / S01E01.tc.ass).
 */
export function findSubtitles(files: string[], videoFile: string): string[] {
  return findAssociatedFiles("", files, videoFile).filter((file) =>
    subtitleFileExtensions.some((ext) => file.endsWith(ext)),
  );
}

/** Exact stem match: S01E01.mkv → S01E01.nfo */
export function findNfos(files: string[], videoFile: string): string[] {
  const videoFileExt = extname(videoFile);
  const nfoFilePath = `${videoFile.replace(videoFileExt, ".nfo")}`;
  return files.filter((file) => file === nfoFilePath);
}
