import { describe, expect, test } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { SCRAPE_JOB_CREATED_MESSAGE } from '@smm/types/ai-tools/scrape'
import { Path } from '@smm/utils/path'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import {
  folder2,
  seedMediaMetadata,
  setupTestMediaFolders,
  writeUserConfig,
  type TestFolder,
} from './lib/testSetup'

const TV_SHOW_METADATA_TEMPLATE = '天使降临到我身边.metadata.json'
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

function findImageWithPrefix(dir: string, prefix: string): string | undefined {
  return readdirSync(dir).find((name) => {
    if (!name.startsWith(`${prefix}.`)) return false
    return IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
  })
}

function expectNonEmptyFile(filePath: string): void {
  expect(existsSync(filePath)).toBe(true)
  expect(statSync(filePath).size).toBeGreaterThan(0)
}

/**
 * User scenario: scrape a recognized movie folder, poll until the job finishes,
 * then verify job tasks and on-disk poster / fanart / movie.nfo.
 * Movie fixture: Core skips thumbnails (no episode-still downloads).
 */
describe('MCP Other - ScrapeTool', () => {
  const ctx = useMcpServer()

  test(
    'scrape movie folder then get-job until succeeded with artwork and nfo',
    async () => {
      const media = await setupTestMediaFolders()
      try {
        const movieFolder: TestFolder = {
          ...folder2,
          folderName: '哪吒之魔童降世 (2019) {tmdbid=552524}',
          files: ['movie.mkv'],
        }
        const folder = media.materialize(movieFolder)
        const folderPath = folder.path!
        await writeUserConfig(ctx.userDataDir, { folders: [folderPath] })
        await seedMediaMetadata(ctx.appDataDir, folder, TV_SHOW_METADATA_TEMPLATE, (mm) => {
          mm.type = 'movie-folder'
          mm.tvShow = undefined
          mm.movie = {
            database: 'TMDB',
            id: '552524',
            name: '哪吒之魔童降世',
          }
          return mm
        })

        const scrapeResult = await callTool(ctx.url, 'scrape', {
          path: folderPath,
          language: 'zh-CN',
        })
        expect(scrapeResult.isError).toBe(false)
        const sc = scrapeResult.structuredContent!
        expect(sc.id).toBeTruthy()
        expect(sc.message).toBe(SCRAPE_JOB_CREATED_MESSAGE)
        expect(sc.error).toBeUndefined()

        const jobId = sc.id as string

        let job: Record<string, unknown> | null = null
        const deadline = Date.now() + 90_000
        while (Date.now() < deadline) {
          const jobResult = await callTool(ctx.url, 'get-job', { id: jobId })
          const jobSc = jobResult.structuredContent
          const status = (jobSc?.job as { status?: string } | undefined)?.status
          job = (jobSc?.job as Record<string, unknown>) ?? null
          if (status === 'succeeded' || status === 'failed') break
          await new Promise((r) => setTimeout(r, 1000))
        }

        expect(job).not.toBeNull()
        expect(job!.kind).toBe('scrape')
        expect(job!.id).toBe(jobId)
        expect(job!.status).toBe('succeeded')
        const tasks = job!.tasks as {
          poster: { status: string }
          fanart: { status: string }
          thumbnails: { status: string }
          nfo: { status: string }
        }
        expect(tasks.poster.status).toMatch(/completed|skipped/)
        expect(tasks.fanart.status).toMatch(/completed|skipped/)
        expect(tasks.thumbnails.status).toBe('skipped')
        expect(tasks.nfo.status).toMatch(/completed|skipped/)

        const platformFolder = Path.toPlatformPath(folderPath)
        const poster = findImageWithPrefix(platformFolder, 'poster')
        const fanart = findImageWithPrefix(platformFolder, 'fanart')
        expect(poster).toBeDefined()
        expect(fanart).toBeDefined()
        expectNonEmptyFile(join(platformFolder, poster!))
        expectNonEmptyFile(join(platformFolder, fanart!))

        const movieNfoPath = join(platformFolder, 'movie.nfo')
        expectNonEmptyFile(movieNfoPath)
        expect(readFileSync(movieNfoPath, 'utf-8')).toContain('<tmdbid>552524</tmdbid>')
      } finally {
        await media.cleanup()
      }
    },
    150_000,
  )
})
