import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import { createBeforeHook } from '../lib/testbed'
import env from 'test/lib/env'
import { createFolderInTestFolder, folder1, folder2 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import { getMediaFoldersTool } from 'test/lib/debugGetMediaFoldersTool'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')

describe('AI Assistant - GetMediaFolders Tool', async () => {
  before(async () => {
    await createBeforeHook({ setupMediaFolders: false, setupMediaMetadata: false })()
  })

  after(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('Gets managed media folders after importing folders', async function () {
    if (env.slowdown) {
      this.timeout(5 * 60 * 1000)
    }

    const tvFolder = createFolderInTestFolder({
      ...folder1,
      path: undefined,
    })
    const movieFolder = createFolderInTestFolder({
      ...folder2,
      path: undefined,
    })

    await Menu.importMediaFolder({
      type: tvFolder.type,
      folderPathInPlatformFormat: tvFolder.path!,
      traceId: 'e2eTest:GetMediaFolders:Import TV Folder',
    })
    await Menu.importMediaFolder({
      type: movieFolder.type,
      folderPathInPlatformFormat: movieFolder.path!,
      traceId: 'e2eTest:GetMediaFolders:Import Movie Folder',
    })

    await Sidebar.waitForFolderName(tvFolder.mediaName!, 60000)
    await Sidebar.waitForFolderName(movieFolder.mediaName!, 60000)

    const response = await getMediaFoldersTool()

    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    expect(response.error).toBeUndefined()
    expect(Array.isArray(response.data?.folders)).toBe(true)
    expect(response.data?.folders).toContain(tvFolder.path!)
    expect(response.data?.folders).toContain(movieFolder.path!)

    if (env.slowdown) {
      await browser.pause(5 * 1000)
    }
  })
})
