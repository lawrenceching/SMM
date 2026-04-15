import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { Path } from '@smm/core'
import Menu from '../componentobjects/Menu'
import { createBeforeHook } from '../lib/testbed'
import env from 'test/lib/env'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import { getMediaMetadata } from 'test/lib/getMediaMetadataTool'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')

describe('AI Assistant - GetMediaMetadata Tool', async () => {
  before(async () => {
    await createBeforeHook({ setupMediaFolders: false, setupMediaMetadata: false })()
  })

  after(async () => {
    if (fs.existsSync(tmpMediaRoot)) {
      fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
      console.log('Removed tmp media folder:', tmpMediaRoot)
    }
  })

  it('Gets media metadata for an imported folder', async function () {
    if (env.slowdown) {
      this.timeout(5 * 60 * 1000)
    }

    const folder = createFolderInTestFolder({
      ...folder1,
      path: undefined,
    })

    await Menu.importMediaFolder({
      type: folder.type,
      folderPathInPlatformFormat: folder.path!,
      traceId: 'e2eTest:GetMediaMetadata:Import TV Folder',
    })

    await Sidebar.waitForFolderName(folder.mediaName!, 60000)

    const response = await getMediaMetadata({
      mediaFolderPath: folder.path!,
    })

    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    expect(response.error).toBeUndefined()
    expect(typeof response.data?.mediaFolderPath).toBe('string')
    expect(response.data?.mediaFolderPath).toBe(Path.toPlatformPath(folder.path!))
    expect(['tvshow-folder', 'movie-folder', 'music-folder']).toContain(response.data?.type)

    if (env.slowdown) {
      await browser.pause(5 * 1000)
    }
  })
})
