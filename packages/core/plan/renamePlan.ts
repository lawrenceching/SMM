import type { MediaMetadata, RenameValidationResult } from '../types'
import type { RenameFilesPlan } from '../types/RenameFilesPlan'
import type { PlanCreator, PlanStatus } from '../types/planCommon'
import { Path } from '../path'

export function createEmptyRenamePlan(
  mediaFolderPath: string,
  id?: string,
  options?: { creator?: PlanCreator; status?: PlanStatus },
): RenameFilesPlan {
  const planId =
    id ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

  return {
    id: planId,
    task: 'rename-files',
    status: options?.status ?? 'pending',
    creator: options?.creator ?? 'app',
    mediaFolderPath: Path.posix(mediaFolderPath),
    files: [],
  }
}

export function assertMediaFolderHasMetadata(
  exists: boolean,
  folderPath: string,
): string | undefined {
  if (!exists) {
    return `Error Reason: folderPath "${Path.posix(folderPath)}" is not opened in SMM`
  }
  return undefined
}

export function assertEpisodeVideoFile(
  metadata: MediaMetadata,
  fromPath: string,
): string | undefined {
  const fromPosix = Path.posix(fromPath)
  const mediaFile = (metadata.mediaFiles ?? []).find(
    (mf) => mf.absolutePath === fromPosix,
  )
  if (!mediaFile) {
    return 'Error Reason: Not Episode Video File'
  }
  return undefined
}

export interface PrepareAppendRenameEntryDeps {
  validateOperations: (
    files: Array<{ from: string; to: string }>,
    folderPathInPosix: string,
  ) => Promise<RenameValidationResult>
  getMediaMetadata: (
    folderPathInPosix: string,
  ) => Promise<MediaMetadata | null>
}

export async function prepareAppendRenameEntry(
  plan: RenameFilesPlan,
  entry: { from: string; to: string },
  deps: PrepareAppendRenameEntryDeps,
): Promise<RenameFilesPlan | { error: string }> {
  const fromPosix = Path.posix(entry.from)
  const toPosix = Path.posix(entry.to)
  const candidateFiles = [...plan.files, { from: fromPosix, to: toPosix }]

  const validationResult = await deps.validateOperations(
    candidateFiles,
    plan.mediaFolderPath,
  )
  if (!validationResult.isValid) {
    return { error: `Error Reason: ${validationResult.errors.join('\n')}` }
  }

  const mm = await deps.getMediaMetadata(plan.mediaFolderPath)
  if (!mm) {
    return {
      error: `Error Reason: Media metadata not found for media folder: ${plan.mediaFolderPath}`,
    }
  }

  const episodeError = assertEpisodeVideoFile(mm, fromPosix)
  if (episodeError) {
    return { error: episodeError }
  }

  return {
    ...plan,
    files: [...plan.files, { from: fromPosix, to: toPosix }],
  }
}

export function toUIRenameFilesPlanPaths(plan: RenameFilesPlan): RenameFilesPlan {
  return {
    ...plan,
    mediaFolderPath: Path.toPlatformPath(plan.mediaFolderPath),
    files: plan.files.map((f) => ({
      from: Path.toPlatformPath(f.from),
      to: Path.toPlatformPath(f.to),
    })),
  }
}
