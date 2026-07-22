import { expect } from '@wdio/globals'
import mcpClient from 'test/lib/McpClient'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'
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
describe('MCP Other - GetMediaMetadataTool', () => {
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

  it('GetMediaMetadataTool should return cached metadata for folder', async () => {
    const folderPath = await createAndImportFolderViaBrowser(
      folder1,
      'e2eTest:GetMediaMetadataTool',
      testFolder,
    )
    await TVShowPanel.waitForTitleToBe(folder1.translations?.title?.['en-US'] ?? 'N/A')

    const r = await mcpClient.getMediaMetadata(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folderPath,
    })
    const json = JSON.stringify(r)
    expect(json).toContain(folder1.mediaName!)
  })
})
