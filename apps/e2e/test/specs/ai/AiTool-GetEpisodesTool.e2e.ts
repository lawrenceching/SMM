import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../../componentobjects/Menu'
import { createBeforeHook } from '../../lib/testbed'
import env from 'test/lib/env'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import { getEpisodesTool } from 'test/lib/debugGetEpisodesTool'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')

describe('AI Assistant - GetEpisodes Tool', async () => {
  before(async () => {
    await createBeforeHook({ setupMediaFolders: false, setupMediaMetadata: false })()
  })

  after(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('Gets episodes for imported tv show folder', async function () {
    if (env.slowdown) {
      this.timeout(5 * 60 * 1000)
    }

    const tvFolder = createFolderInTestFolder({
      ...folder1,
      path: undefined,
    })

    await Menu.importMediaFolder({
      type: tvFolder.type,
      folderPathInPlatformFormat: tvFolder.path!,
      traceId: 'e2eTest:GetEpisodesTool:Import TV Folder',
    })

    await Sidebar.waitForFolderName(tvFolder.folderName!, 60000)

    let finalResponse = await getEpisodesTool({ mediaFolderPath: tvFolder.path! })
    await browser.waitUntil(async () => {
      finalResponse = await getEpisodesTool({ mediaFolderPath: tvFolder.path! })
      return finalResponse.success && (finalResponse.data?.totalCount ?? 0) > 0
    }, {
      timeout: 60000,
      timeoutMsg: 'getEpisodes tool did not return episodes in time',
      interval: 2000,
    })

    expect(finalResponse.success).toBe(true)
    expect(finalResponse.data).toBeDefined()
    expect(finalResponse.error).toBeUndefined()
    expect((finalResponse.data?.totalCount ?? 0)).toBeGreaterThan(0)
    expect((finalResponse.data?.numberOfSeasons ?? 0)).toBeGreaterThan(0)
    expect((finalResponse.data?.showName ?? '').length).toBeGreaterThan(0)

    const firstEpisode = finalResponse.data?.episodes[0]
    expect(firstEpisode).toBeDefined()
    expect(typeof firstEpisode?.season).toBe('number')
    expect(typeof firstEpisode?.episode).toBe('number')

    if (env.slowdown) {
      await browser.pause(5 * 1000)
    }
  })
})
