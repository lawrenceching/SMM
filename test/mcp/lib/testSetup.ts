import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { TestFolder } from '@smm/test'
import { Path } from '@smm/core/path'
import type { MediaMetadata, UserConfig } from '@smm/core/types'

export {
  folder1,
  folder2,
  folder3,
  folder4,
  folder5,
  folder6,
  musicFolder,
  tvShowFolder,
  movieFolder,
  type TestFolder,
} from '@smm/test'

/**
 * Resolve the repo root from this file (`test/mcp/lib/` → repo root).
 */
export function repoRoot(): string {
  return resolve(import.meta.dir, '..', '..', '..')
}

/**
 * Write the `smm.json` user config for a test server.
 * @param userDataDir The `USER_DATA_DIR` for the spawned MCP server.
 * @param userConfig Full user config to write.
 */
export async function writeUserConfig(
  userDataDir: string,
  userConfig: Partial<UserConfig>,
): Promise<void> {
  await mkdir(userDataDir, { recursive: true })
  const defaults: UserConfig = {
    applicationLanguage: 'en',
    tmdb: {},
    tvdb: {},
    folders: [],
    renameRules: [],
    dryRun: false,
    aiProviders: [],
    primaryDatabase: 'TMDB',
    preferMediaLanguage: undefined,
    selectedTMDBIntance: 'public',
    selectedFolder: undefined,
    selectedRenameRule: 'Plex(TvShow/Anime)',
    enableMcpServer: false,
    mcpHost: '127.0.0.1',
    mcpPort: 30001,
  }
  await writeFile(
    join(userDataDir, 'smm.json'),
    JSON.stringify({ ...defaults, ...userConfig }, null, 2),
    'utf-8',
  )
}

/**
 * The metadata cache dir (`{appDataDir}/metadata`), matching
 * `packages/core-routes`.
 */
export function metadataDir(appDataDir: string): string {
  return join(appDataDir, 'metadata')
}

/**
 * The cache filename for a media folder path, matching
 * `metadataCacheFilePath` in `packages/core-routes/src/mediaMetadataCache.ts`.
 */
export function metadataCacheFilePath(appDataDir: string, folderPathInPosix: string): string {
  const filename = folderPathInPosix.replace(/[\/\\:?*|<>"]/g, '_')
  return join(metadataDir(appDataDir), `${filename}.json`)
}

/**
 * Seed cached media metadata for a folder by writing directly into
 * `{appDataDir}/metadata/`. Mirrors `importFolderWithMediaMetadata` from
 * `apps/e2e/test/lib/testbed.ts`, but writes to disk instead of the browser.
 */
export async function seedMediaMetadata(
  appDataDir: string,
  folder: TestFolder,
  templateFileName: string,
  updateMediaMetadata?: (mediaMetadata: MediaMetadata) => MediaMetadata,
): Promise<void> {
  const folderPath = folder.path
  if (folderPath === undefined || folderPath === '') {
    throw new Error('seedMediaMetadata: folder.path is required')
  }

  const templatePath = join(repoRoot(), 'test', 'templates', 'mediaMetadatas', templateFileName)
  const template = JSON.parse(await readFile(templatePath, 'utf-8')) as MediaMetadata

  const mediaMetadata: MediaMetadata = {
    ...template,
    mediaFolderPath: Path.posix(folderPath),
    mediaFiles: template.mediaFiles?.map((file) => ({
      ...file,
      absolutePath: Path.posix(join(folderPath, file.absolutePath)),
    })),
  }
  const updated =
    updateMediaMetadata !== undefined ? updateMediaMetadata(mediaMetadata) : mediaMetadata

  const filePath = metadataCacheFilePath(appDataDir, Path.posix(folderPath))
  await mkdir(metadataDir(appDataDir), { recursive: true })
  await writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8')
}

export interface TestMediaFolders {
  /** Directory holding all materialized test media folders. */
  mediaDir: string
  /** Materialize a fixture under `mediaDir` and return the created folder. */
  materialize: (folder: TestFolder) => TestFolder
  /** Remove the temporary media tree created by `setup`. */
  cleanup: () => Promise<void>
}

function copyRecursiveSync(source: string, destination: string): void {
  const stats = statSync(source)
  if (stats.isDirectory()) {
    mkdirSync(destination, { recursive: true })
    for (const item of readdirSync(source)) {
      copyRecursiveSync(join(source, item), join(destination, item))
    }
  } else {
    copyFileSync(source, destination)
  }
}

function createFolderOnDisk(mediaDir: string, folder: TestFolder): TestFolder {
  const testMediaFolder = join(mediaDir, folder.folderName)
  mkdirSync(testMediaFolder, { recursive: true })
  for (const file of folder.files) {
    writeFileSync(join(testMediaFolder, file), '')
  }
  return { ...folder, path: testMediaFolder }
}

/**
 * Copy the shared `test/media` fixture tree into a fresh per-test temp dir
 * and materialize folders. Unlike `@smm/test`'s `setupTestMediaFolders`
 * (which uses a shared `os.tmpdir()/smm-test-media`), each test gets an
 * isolated tree so parallel `bun test` files don't clobber each other.
 */
export async function setupTestMediaFolders(): Promise<TestMediaFolders> {
  const root = repoRoot()
  const tmpDir = await mkdtemp(join(tmpdir(), 'smm-mcp-media-'))
  const mediaDir = join(tmpDir, 'media')
  copyRecursiveSync(join(root, 'test', 'media'), mediaDir)

  const materialize = (folder: TestFolder): TestFolder => createFolderOnDisk(mediaDir, folder)

  return {
    mediaDir,
    materialize,
    cleanup: async () => {
      await rm(tmpDir, { recursive: true, force: true })
    },
  }
}

/** Remove everything under `{appDataDir}/metadata` (for clean slates). */
export async function clearMetadataDir(appDataDir: string): Promise<void> {
  await rm(metadataDir(appDataDir), { recursive: true, force: true })
}
