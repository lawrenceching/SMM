import { describe, expect, test } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { MediaMetadata } from '@smm/types'
import { Path } from '@smm/utils/path'
import { callTool } from './lib/mcpInspectorClient'
import { dockerPathExists } from './lib/remoteDocker'
import { seedForTarget } from './lib/remoteFixtures'
import { getRemoteMetadata } from './lib/remoteHttp'
import { useMcpServer } from './lib/useMcpServer'
import {
  folder1,
  folder2,
  metadataCacheFilePath,
  type TestFolder,
} from './lib/testSetup'

function joinOnTarget(isRemote: boolean, dir: string, name: string): string {
  return isRemote ? path.posix.join(dir, name) : path.join(dir, name)
}

function dirnameOnTarget(isRemote: boolean, folderPath: string): string {
  return isRemote ? path.posix.dirname(folderPath) : path.dirname(folderPath)
}

function asMovieFolder(
  movie: { database: 'TMDB' | 'TVDB'; id: string; name: string },
  files: string[],
): (mm: MediaMetadata) => MediaMetadata {
  return (mm) => {
    mm.type = 'movie-folder'
    mm.tvShow = undefined
    const folderAbs = new Path(mm.mediaFolderPath!)
    mm.mediaFiles = files.map((file) => ({
      absolutePath: folderAbs.join(file).abs('posix'),
    })) as MediaMetadata['mediaFiles']
    mm.movie = {
      database: movie.database,
      id: movie.id,
      name: movie.name,
    }
    return mm
  }
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

  async function seedRecognizedFolder(
    folder: TestFolder,
    movie?: { database: 'TMDB' | 'TVDB'; id: string; name: string },
  ): Promise<{ path: string; cleanup: () => Promise<void> }> {
    return seedForTarget(
      ctx,
      folder,
      movie ? asMovieFolder(movie, folder.files) : undefined,
    )
  }

  async function expectFolderExists(folderPath: string): Promise<void> {
    if (ctx.isRemote) {
      expect(
        await dockerPathExists({
          container: ctx.containerName!,
          containerPath: folderPath,
        }),
      ).toBe(true)
      return
    }
    expect(existsSync(folderPath)).toBe(true)
  }

  async function readMetadata(folderPath: string): Promise<MediaMetadata | null> {
    if (ctx.isRemote) {
      return getRemoteMetadata(ctx.httpServerAddress!, ctx.authToken!, folderPath)
    }
    return readMetadataCache(ctx.appDataDir, folderPath)
  }

  test('TV Show: renames folder and updates metadata cache', async () => {
    const seeded = await seedRecognizedFolder({ ...folder1 })
    try {
      const newFolderName = `new-${folder1.folderName}`
      const newFolderPath = joinOnTarget(
        ctx.isRemote,
        dirnameOnTarget(ctx.isRemote, seeded.path),
        newFolderName,
      )

      const r = await callTool(ctx.url, 'rename-folder', {
        from: seeded.path,
        to: newFolderPath,
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.renamed).toBe(true)
      expect(sc.from).toBe(seeded.path)
      expect(sc.to).toBe(newFolderPath)

      await expectFolderExists(newFolderPath)

      const mm = await readMetadata(newFolderPath)
      expect(mm).not.toBeNull()
      expect(mm!.tvShow).toBeDefined()
    } finally {
      await seeded.cleanup()
    }
  })

  test('Movie: renames folder and updates metadata cache', async () => {
    const seeded = await seedRecognizedFolder(
      { ...folder2 },
      {
        database: 'TMDB',
        id: '1311031',
        name: folder2.translations?.title?.['en-US'] ?? folder2.mediaName!,
      },
    )
    try {
      const newFolderName = `new-${folder2.folderName}`
      const newFolderPath = joinOnTarget(
        ctx.isRemote,
        dirnameOnTarget(ctx.isRemote, seeded.path),
        newFolderName,
      )

      const r = await callTool(ctx.url, 'rename-folder', {
        from: seeded.path,
        to: newFolderPath,
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.renamed).toBe(true)
      expect(sc.from).toBe(seeded.path)
      expect(sc.to).toBe(newFolderPath)

      await expectFolderExists(newFolderPath)

      const mm = await readMetadata(newFolderPath)
      expect(mm).not.toBeNull()
      expect(mm!.movie).toBeDefined()
    } finally {
      await seeded.cleanup()
    }
  })
})
