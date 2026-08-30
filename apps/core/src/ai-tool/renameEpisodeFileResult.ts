import { Path } from '@smm/utils/path'
import type { RenameEpisodeFileOutput } from '@smm/types/ai-tools/renameEpisodeFile'
import { RENAME_EPISODE_FILE_CANCELLED } from '@smm/types/ai-tools/renameEpisodeFile'

export function renameEpisodeFileCancelled(
  mediaFolder: string,
  from: string,
  to: string,
): RenameEpisodeFileOutput {
  return {
    renamed: false,
    mediaFolder: Path.toPlatformPath(mediaFolder),
    from: Path.toPlatformPath(from),
    to: Path.toPlatformPath(to),
    succeeded: [],
    failed: [],
    error: RENAME_EPISODE_FILE_CANCELLED,
  }
}

export function renameEpisodeFileFailed(
  mediaFolder: string,
  from: string,
  to: string,
  error: string,
): RenameEpisodeFileOutput {
  return {
    renamed: false,
    mediaFolder: Path.toPlatformPath(mediaFolder),
    from: Path.toPlatformPath(from),
    to: Path.toPlatformPath(to),
    succeeded: [],
    failed: [],
    error,
  }
}

export function renameEpisodeFileSucceeded(
  mediaFolder: string,
  from: string,
  to: string,
  succeeded: Array<{ from: string; to: string }>,
  failed: Array<{ path: string; error: string }> = [],
): RenameEpisodeFileOutput {
  return {
    renamed: succeeded.length > 0,
    mediaFolder: Path.toPlatformPath(mediaFolder),
    from: Path.toPlatformPath(from),
    to: Path.toPlatformPath(to),
    succeeded: succeeded.map((p) => ({
      from: Path.toPlatformPath(p.from),
      to: Path.toPlatformPath(p.to),
    })),
    failed,
    ...(failed.length > 0
      ? { error: failed.map((f) => f.error).join('; ') }
      : {}),
  }
}
