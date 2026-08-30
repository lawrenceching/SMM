import { describe, expect, it } from 'bun:test'
import { SCRAPE_JOB_CREATED_MESSAGE } from '@smm/types/ai-tools/scrape'
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

/**
 * Movie fixture: Core skips thumbnails so this contract test does not
 * hang on episode-still downloads.
 */
describe('MCP Other - ScrapeTool', () => {
  const ctx = useMcpServer()

  it('scrape starts a job; get-job polls until terminal', async () => {
    const media = await setupTestMediaFolders()
    try {
      const movieFolder: TestFolder = {
        ...folder2,
        folderName: '哪吒之魔童降世 (2019) {tmdbid=552524}',
        files: ['movie.mkv'],
      }
      const folder = media.materialize(movieFolder)
      await writeUserConfig(ctx.userDataDir, { folders: [folder.path!] })
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
        path: folder.path!,
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
    } finally {
      await media.cleanup()
    }
  }, 150_000)
})
