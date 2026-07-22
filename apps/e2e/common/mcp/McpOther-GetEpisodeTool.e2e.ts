import { expect } from '@wdio/globals'
import mcpClient from 'test/lib/McpClient'
import Sidebar from 'test/componentobjects/Sidebar'
import { folder1 } from 'test/actions/import-folders'
import { cleanup, setup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'
import {
  clearFolderViaBrowser,
  createAndImportFolderViaBrowser,
  resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

/**
 * @supports local, Electron
 * @unsupported HarmonyOS
 */
describe('MCP Other - GetEpisodeTool', () => {
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

  it('GetEpisodeTool should return mapped video file path', async () => {
    const folderPath = await createAndImportFolderViaBrowser(
      folder1,
      'e2eTest:McpGetEpisodeTool',
      testFolder,
    )
    await Sidebar.waitForFolderName(folder1.folderName, 2000)

    await browser.pause(4000)

    const r = await mcpClient.getEpisode(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folderPath,
      season: 1,
      episode: 1,
    })
    expect(r.message).toBe('succeeded')
    expect(r.season).toBe(1)
    expect(r.episode).toBe(1)
    expect(r.videoFilePath).toContain('S01E01.mkv')
  })
})
