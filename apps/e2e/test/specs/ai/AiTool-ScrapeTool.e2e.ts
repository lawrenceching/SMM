import { expect, browser } from '@wdio/globals'
import { Path } from '@smm/core'
import { SCRAPE_JOB_CREATED_MESSAGE } from '@smm/core/types/ai-tools/scrape'
import { createBeforeHook, importFolderWithMediaMetadata } from '../../lib/testbed'
import env from 'test/lib/env'
import { createFolderInTestFolder, folder2 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import page from 'test/pageobjects/page'
import { scrapeTool } from 'test/lib/debugScrapeTool'
import { getJobTool } from 'test/lib/debugGetJobTool'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')

/**
 * Uses a movie folder so Core skips thumbnails (legacy parity). That keeps
 * this AI-tool contract test off the flaky episode-still download path.
 *
 * @supports local, Electron, Docker
 */
describe('AI Assistant - Scrape Tool', async () => {
  before(async () => {
    await createBeforeHook({ setupMediaFolders: false, setupMediaMetadata: false })()
  })

  after(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('starts scrape via scrape tool and polls status via get-job tool', async function () {
    this.timeout(env.slowdown ? 5 * 60 * 1000 : 120 * 1000)

    const folder = createFolderInTestFolder({
      ...folder2,
      path: undefined,
      folderName: '哪吒之魔童降世 (2019) {tmdbid=552524}',
      files: ['movie.mkv'],
    })

    await importFolderWithMediaMetadata(
      folder,
      '天使降临到我身边.metadata.json',
      (mediaMetadata) => {
        mediaMetadata.type = 'movie-folder'
        mediaMetadata.tvShow = undefined
        mediaMetadata.mediaFiles = [
          {
            absolutePath: Path.posix(path.join(folder.path!, 'movie.mkv')),
          },
        ]
        mediaMetadata.movie = {
          database: 'TMDB',
          id: '552524',
          name: '哪吒之魔童降世',
        }
        return mediaMetadata
      },
    )

    await page.refresh()
    await Sidebar.waitForFolderName(folder.folderName!, 60_000)
    await browser.pause(1000)

    const scrapeResponse = await scrapeTool({
      path: folder.path!,
      language: 'zh-CN',
    })

    expect(scrapeResponse.success).toBe(true)
    expect(scrapeResponse.error).toBeUndefined()
    expect(scrapeResponse.data?.id).toBeTruthy()
    expect(scrapeResponse.data?.message).toBe(SCRAPE_JOB_CREATED_MESSAGE)

    const jobId = scrapeResponse.data!.id

    await browser.waitUntil(
      async () => {
        const jobResponse = await getJobTool({ id: jobId })
        const status = jobResponse.data?.job?.status
        return status === 'succeeded' || status === 'failed'
      },
      {
        timeout: 90_000,
        interval: 1000,
        timeoutMsg: `Scrape job ${jobId} did not reach a terminal status`,
      },
    )

    const finalJob = await getJobTool({ id: jobId })
    expect(finalJob.success).toBe(true)
    expect(finalJob.data?.job?.kind).toBe('scrape')
    expect(finalJob.data?.job?.id).toBe(jobId)
    expect(finalJob.data?.job?.status).toBe('succeeded')
    expect(finalJob.data?.job?.tasks?.poster?.status).toMatch(/completed|skipped/)
    expect(finalJob.data?.job?.tasks?.fanart?.status).toMatch(/completed|skipped/)
    expect(finalJob.data?.job?.tasks?.thumbnails?.status).toBe('skipped')
    expect(finalJob.data?.job?.tasks?.nfo?.status).toMatch(/completed|skipped/)

    if (env.slowdown) {
      await browser.pause(5 * 1000)
    }
  })
})
