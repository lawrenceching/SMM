import { expect, browser } from '@wdio/globals'
import { SCRAPE_JOB_CREATED_MESSAGE } from '@smm/core/types/ai-tools/scrape'
import mcpClient from 'test/lib/McpClient'
import { folder2 } from 'test/actions/import-folders'
import { cleanup, setup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'
import {
  clearFolderViaBrowser,
  resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  seedRecognizedMovieFolder,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

/**
 * Movie fixture: Core skips thumbnails so this contract test does not
 * hang on episode-still downloads.
 *
 * @supports local, Electron, Docker
 * @unsupported HarmonyOS
 */
describe('MCP Other - ScrapeTool', () => {
  const ctx = createMcpSpecContext()
  let testFolder = ''

  before(function () {
    skipIfOhos(this)
  })

  beforeEach(async () => {
    await setup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
      openBrowserPage: true,
      os: testbedOs,
    })
    await setupMcpTest()

    testFolder = await resolveSmmTestFolderViaBrowser()
    await clearFolderViaBrowser(testFolder)
  })

  afterEach(async () => {
    await cleanupMcpTest()
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: false,
      os: testbedOs,
    })
    if (testFolder) {
      await clearFolderViaBrowser(testFolder)
    }
  })

  it('scrape starts a job; get-job polls until terminal', async function () {
    this.timeout(120 * 1000)

    const folderPath = await seedRecognizedMovieFolder(
      {
        ...folder2,
        folderName: '哪吒之魔童降世 (2019) {tmdbid=552524}',
        files: ['movie.mkv'],
      },
      testFolder,
      {
        database: 'TMDB',
        id: '552524',
        name: '哪吒之魔童降世',
      },
    )

    const scrapeResult = await mcpClient.scrape(ctx.clientCwd, ctx.mcpAddress, {
      path: folderPath,
      language: 'zh-CN',
    })

    expect(scrapeResult.id).toBeTruthy()
    expect(scrapeResult.message).toBe(SCRAPE_JOB_CREATED_MESSAGE)
    expect(scrapeResult.error).toBeUndefined()

    const jobId = scrapeResult.id

    await browser.waitUntil(
      async () => {
        const jobResult = await mcpClient.getJob(ctx.clientCwd, ctx.mcpAddress, {
          id: jobId,
        })
        const status = jobResult.job?.status
        return status === 'succeeded' || status === 'failed'
      },
      {
        timeout: 90_000,
        interval: 1000,
        timeoutMsg: `Scrape job ${jobId} did not reach a terminal status`,
      },
    )

    const finalJob = await mcpClient.getJob(ctx.clientCwd, ctx.mcpAddress, {
      id: jobId,
    })
    expect(finalJob.job?.kind).toBe('scrape')
    expect(finalJob.job?.id).toBe(jobId)
    expect(finalJob.job?.status).toBe('succeeded')
    if (finalJob.job?.kind === 'scrape') {
      expect(finalJob.job.tasks.poster.status).toMatch(/completed|skipped/)
      expect(finalJob.job.tasks.fanart.status).toMatch(/completed|skipped/)
      expect(finalJob.job.tasks.thumbnails.status).toBe('skipped')
      expect(finalJob.job.tasks.nfo.status).toMatch(/completed|skipped/)
    }
  })
})
