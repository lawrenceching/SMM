import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'
import { Path } from '@smm/utils/path'
import type { MediaMetadata } from '@smm/types'
import { getCore } from '../../src/core/getCore'
import { smm } from './smm'

export {
  type LangCode,
  type TestFolder,
  folder1,
  folder2,
  folder3,
  folder4,
  folder5,
  folder6,
  musicFolder,
  tvShowFolder,
  movieFolder,
  createFolderInTestFolder,
} from '@smm/test'

import { createFolderInTestFolder, type TestFolder } from '@smm/test'

const helpersDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(helpersDir, '../../../..')
const MEDIA_METADATA_TEMPLATES_DIR = join(repoRoot, 'test', 'templates', 'mediaMetadatas')

/** Same sanitization as Core `metadataCachePath` / core-routes cache. */
export function metadataCachePath(appDataDir: string, folderPathInPosix: string): string {
  const filename = folderPathInPosix.replace(/[/\\:?*|<>"]/g, '_')
  return join(appDataDir, 'metadata', `${filename}.json`)
}

/** Sibling path with " - Renamed" suffix (same naming as e2e RenameFolder). */
export function renamedFolderPath(folderPath: string, folderName: string): string {
  return join(dirname(folderPath), `${folderName} - Renamed`)
}

function loadTemplate(templateFileName: string): MediaMetadata {
  const templatePath = join(MEDIA_METADATA_TEMPLATES_DIR, templateFileName)
  return JSON.parse(readFileSync(templatePath, 'utf-8')) as MediaMetadata
}

function rewritePathsForFolder(mediaMetadata: MediaMetadata, folderPath: string): MediaMetadata {
  const folderPosix = Path.posix(folderPath)
  return {
    ...mediaMetadata,
    mediaFolderPath: folderPosix,
    mediaFiles: mediaMetadata.mediaFiles?.map((file) => ({
      ...file,
      absolutePath: Path.posix(join(folderPath, file.absolutePath)),
    })),
  }
}

export type CreateAndImportInitializedFolderOptions = {
  /** Explicit metadata. When omitted, loads `templateFileName` (or default TV template). */
  mediaMetadata?: MediaMetadata
  templateFileName?: string
  updateMediaMetadata?: (mediaMetadata: MediaMetadata) => MediaMetadata
}

/**
 * Create on-disk files from a TestFolder fixture, `smm add --skip-init`,
 * then seed metadata via `Core.setMetadata` (no recognition / TMDB).
 */
export async function createAndImportInitializedFolder(
  mediaDir: string,
  folder: TestFolder,
  options: CreateAndImportInitializedFolderOptions = {},
): Promise<TestFolder> {
  if (!process.env.USER_DATA_DIR) {
    throw new Error('createAndImportInitializedFolder: USER_DATA_DIR must be set')
  }

  const created = createFolderInTestFolder(mediaDir, folder)
  const folderPath = created.path!

  const added = await smm(['add', folderPath, '--type', created.type, '--skip-init'])
  expect(added.code, added.stderr || added.stdout).toBe(0)

  let mediaMetadata: MediaMetadata
  if (options.mediaMetadata) {
    mediaMetadata = {
      ...options.mediaMetadata,
      mediaFolderPath: Path.posix(folderPath),
    }
  } else {
    const templateFileName = options.templateFileName ?? '天使降临到我身边.metadata.json'
    mediaMetadata = rewritePathsForFolder(loadTemplate(templateFileName), folderPath)
  }

  if (options.updateMediaMetadata) {
    mediaMetadata = options.updateMediaMetadata(mediaMetadata)
  }
  mediaMetadata.mediaFolderPath = Path.posix(folderPath)

  await getCore().setMetadata(folderPath, {
    type: mediaMetadata.type,
    mediaFiles: mediaMetadata.mediaFiles,
    tvShow: mediaMetadata.tvShow,
    movie: mediaMetadata.movie,
  })

  return created
}
