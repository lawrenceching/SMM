import type { MediaMetadata } from "@smm/types";
import { Path } from "@smm/utils/path";
import { generateNewFileName, type RenameRuleName } from "./renameRules";
import { joinPosix } from "./paths";
import { mediaFilePathEqual } from "./mediaFilePathEqual";

/**
 * Build rename plan entries for a TV show using the selected naming rule.
 * Omits episodes whose generated path equals the current video path.
 */
export function buildTvShowRenamePlanFileEntries(
  mediaMetadata: MediaMetadata,
  selectedNamingRule: RenameRuleName,
): Array<{ from: string; to: string }> {
  const files: Array<{ from: string; to: string }> = [];
  const tvShow = mediaMetadata.tvShow;
  const mediaFolderPath = mediaMetadata.mediaFolderPath;

  if (!tvShow || !mediaFolderPath) {
    return files;
  }

  for (const season of tvShow.seasons) {
    if (!season.episodes) continue;

    for (const episode of season.episodes) {
      const mediaFile = mediaMetadata.mediaFiles?.find(
        (file) =>
          file.seasonNumber === season.season && file.episodeNumber === episode.episode,
      );

      if (!mediaFile) continue;

      const relativePath = generateNewFileName(selectedNamingRule, {
        type: "tv",
        seasonNumber: season.season,
        episodeNumber: episode.episode,
        episodeName: episode.name || "",
        tvshowName: tvShow.name || "",
        file: mediaFile.absolutePath,
        tmdbId: tvShow.id?.toString() || "",
        releaseYear: tvShow.airDate ?? "",
      });

      const absolutePath = joinPosix(Path.posix(mediaFolderPath), relativePath);
      const from = Path.posix(mediaFile.absolutePath);
      const to = Path.posix(absolutePath);

      if (mediaFilePathEqual(from, to)) {
        continue;
      }

      files.push({ from, to });
    }
  }

  return files;
}
