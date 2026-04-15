import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import { createBeforeHook } from '../lib/testbed'
import env from 'test/lib/env'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import { listFilesTool } from 'test/lib/debugListFilesTool'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')

describe('AI Assistant - ListFiles Tool', async () => {
  before(async () => {
    await createBeforeHook({ setupMediaFolders: false, setupMediaMetadata: false })()
  })

  after(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('Lists files in imported media folder', async function () {
    if (env.slowdown) {
      this.timeout(5 * 60 * 1000)
    }

    const importedFolder = createFolderInTestFolder({
      ...folder1,
      path: undefined,
    })

    await Menu.importMediaFolder({
      type: importedFolder.type,
      folderPathInPlatformFormat: importedFolder.path!,
      traceId: 'e2eTest:ListFilesTool:Import TV Folder',
    })

    await Sidebar.waitForFolderName(importedFolder.mediaName!, 60000)

    const response = await listFilesTool({
      folderPath: importedFolder.path!,
    })

    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    expect(response.error).toBeUndefined()
    expect(response.data?.count).toBe(folder1.files.length)
    expect(response.data?.files.some((file) => file.endsWith('S01E01.mkv'))).toBe(true)
    expect(response.data?.files.some((file) => file.endsWith('S01E03.nfo'))).toBe(true)

    if (env.slowdown) {
      await browser.pause(5 * 1000)
    }
  })
})
