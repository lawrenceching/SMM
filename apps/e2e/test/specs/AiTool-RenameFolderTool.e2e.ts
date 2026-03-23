import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import { createBeforeHook } from '../lib/testbed'
import env from 'test/lib/env'
import { createFolderInTestFolder, folder2 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import { renameFolderTool } from 'test/lib/debugRenameFolderTool'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')

describe('AI Assistant - RenameFolder Tool', async () => {
  before(async () => {
    await createBeforeHook({ setupMediaFolders: false, setupMediaMetadata: false })()
  })

  after(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('Renames an imported media folder via debug tool route', async function () {
    if (env.slowdown) {
      this.timeout(5 * 60 * 1000)
    }

    const sourceFolder = createFolderInTestFolder({
      ...folder2,
      path: undefined,
    })

    await Menu.importMediaFolder({
      type: sourceFolder.type,
      folderPathInPlatformFormat: sourceFolder.path!,
      traceId: 'e2eTest:RenameFolderTool:Import Source Folder',
    })

    await Sidebar.waitForFolder(sourceFolder.mediaName!, 60000)

    await TVShowPanel.searchbox.input.waitForDisplayed()
    await browser.waitUntil(async () => {
      const mediaTitle = await TVShowPanel.searchbox.input.getValue();
      console.log(`waiting for media title to be "${sourceFolder.mediaName}", got "${mediaTitle}"`)
      return mediaTitle === sourceFolder.mediaName
    }, { timeout: 10000 })

    // TOOD: need to wait for the media metadata file to be created
    // await browser.pause(2000)

    const targetFolderPath = path.join(path.dirname(sourceFolder.path!), `${sourceFolder.folderName}-renamed`)
    const response = await renameFolderTool({
      from: sourceFolder.path!,
      to: targetFolderPath,
    })

    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    expect(response.data?.renamed).toBe(true)
    expect(response.data?.error).toBeUndefined()
    expect(response.data?.to).toBe(targetFolderPath)
    expect(fs.existsSync(sourceFolder.path!)).toBe(false)
    expect(fs.existsSync(targetFolderPath)).toBe(true)

    if (env.slowdown) {
      await browser.pause(5 * 1000)
    }
  })
})
