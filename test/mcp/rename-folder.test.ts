import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import {
  folder1,
  folder2,
  metadataCacheFilePath,
  seedMediaMetadata,
  setupTestMediaFolders,
  writeUserConfig,
  type TestFolder,
} from './lib/testSetup'
import type { MediaMetadata } from '@smm/types'
import { Path } from '@smm/utils/path'

const TV_SHOW_METADATA_TEMPLATE = '天使降临到我身边.metadata.json'

interface SeededFolder {
  path: string
  mediaDir: string
  cleanup: () => Promise<void>
}

async function seedRecognizedFolder(
  ctx: { userDataDir: string; appDataDir: string },
  folder: TestFolder,
  movie?: { database: 'TMDB' | 'TVDB'; id: string; name: string },
): Promise<SeededFolder> {
  const media = await setupTestMediaFolders()
  const created = media.materialize(folder)
  await writeUserConfig(ctx.userDataDir, { folders: [created.path!] })
  await seedMediaMetadata(ctx.appDataDir, created, TV_SHOW_METADATA_TEMPLATE, (mm) => {
    if (movie) {
      mm.type = 'movie-folder'
      mm.tvShow = undefined
      mm.mediaFiles = created.files.map((file) => ({
        absolutePath: join(created.path!, file),
      })) as MediaMetadata['mediaFiles']
      mm.movie = {
        database: movie.database,
        id: movie.id,
        name: movie.name,
      }
    }
    return mm
  })
  return { path: created.path!, mediaDir: media.mediaDir, cleanup: () => media.cleanup() }
}

function readMetadataCache(appDataDir: string, folderPath: string): MediaMetadata | null {
  const filePath = metadataCacheFilePath(appDataDir, Path.posix(folderPath))
  if (!existsSync(filePath)) {
    return null
  }
  return JSON.parse(readFileSync(filePath, 'utf-8')) as MediaMetadata
}

describe('MCP Other - RenameFolderTool', () => {
  const ctx = useMcpServer()

  it('TV Show: renames folder and updates metadata cache', async () => {
    const seeded = await seedRecognizedFolder(ctx, { ...folder1 })
    try {
      const newFolderName = `new-${folder1.folderName}`
      const newFolderPath = join(seeded.mediaDir, newFolderName)

      const r = await callTool(ctx.url, 'rename-folder', {
        from: seeded.path,
        to: newFolderPath,
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.renamed).toBe(true)
      expect(sc.from).toBe(seeded.path)
      expect(sc.to).toBe(newFolderPath)

      expect(existsSync(newFolderPath)).toBe(true)

      const mm = readMetadataCache(ctx.appDataDir, newFolderPath)
      expect(mm).not.toBeNull()
      expect(mm!.tvShow).toBeDefined()
    } finally {
      await seeded.cleanup()
    }
  })

  it('Movie: renames folder and updates metadata cache', async () => {
    const seeded = await seedRecognizedFolder(
      ctx,
      { ...folder2 },
      {
        database: 'TMDB',
        id: '1311031',
        name: folder2.translations?.title?.['en-US'] ?? folder2.mediaName!,
      },
    )
    try {
      const newFolderName = `new-${folder2.folderName}`
      const newFolderPath = join(seeded.mediaDir, newFolderName)

      const r = await callTool(ctx.url, 'rename-folder', {
        from: seeded.path,
        to: newFolderPath,
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.renamed).toBe(true)
      expect(sc.from).toBe(seeded.path)
      expect(sc.to).toBe(newFolderPath)

      expect(existsSync(newFolderPath)).toBe(true)

      const mm = readMetadataCache(ctx.appDataDir, newFolderPath)
      expect(mm).not.toBeNull()
      expect(mm!.movie).toBeDefined()
    } finally {
      await seeded.cleanup()
    }
  })
})
