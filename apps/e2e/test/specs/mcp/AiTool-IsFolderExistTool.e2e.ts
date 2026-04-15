import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../../componentobjects/Menu'
import { createBeforeHook } from '../../lib/testbed'
import env from 'test/lib/env'
import { isFolderExistTool } from 'test/lib/debugIsFolderExistTool'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

describe('AI Assistant - IsFolderExist Tool', async () => {
  before(async () => {
    await createBeforeHook({ setupMediaFolders: false, setupMediaMetadata: false })()
  })

  after(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('Returns true for imported Season 01 folder', async function () {
    if (env.slowdown) {
      this.timeout(5 * 60 * 1000)
    }

    const rootFolderPath = path.join(mediaDir, 'is-folder-exist-test')
    const seasonFolderPath = path.join(rootFolderPath, 'Season 01')
    const episodePath = path.join(seasonFolderPath, 'S01E01.mp4')

    fs.mkdirSync(seasonFolderPath, { recursive: true })
    fs.writeFileSync(episodePath, '')

    await Menu.importMediaFolder({
      type: 'tvshow',
      folderPathInPlatformFormat: rootFolderPath,
      traceId: 'e2eTest:IsFolderExistTool:Import Folder',
    })

    const response = await isFolderExistTool({
      path: seasonFolderPath,
    })

    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    expect(response.data?.exists).toBe(true)

    if (env.slowdown) {
      await browser.pause(5 * 1000)
    }
  })

  it('Returns false for non-existing folder', async function () {
    if (env.slowdown) {
      this.timeout(5 * 60 * 1000)
    }

    const missingFolderPath = path.join(mediaDir, 'is-folder-exist-test', 'Season 99')
    const response = await isFolderExistTool({
      path: missingFolderPath,
    })

    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    expect(response.data?.exists).toBe(false)
    expect(typeof response.data?.reason).toBe('string')
    expect((response.data?.reason ?? '').length).toBeGreaterThan(0)
  })
})
