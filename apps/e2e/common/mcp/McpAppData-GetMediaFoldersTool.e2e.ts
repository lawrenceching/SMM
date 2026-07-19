import { expect } from '@wdio/globals'
import mcpClient from 'test/lib/McpClient'
import { folder1 } from 'test/actions/import-folders'
import { cleanup, setup } from 'test/lib/testbed'
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

describe('MCP AppData - GetMediaFoldersTool', () => {
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
    })
    if (testFolder) {
      await clearFolderViaBrowser(testFolder)
    }
  })

  it('GetMediaFoldersTool should return folders field', async () => {
    let r = await mcpClient.getMediaFolders(ctx.clientCwd, ctx.mcpAddress)
    expect(r.folders.length).toEqual(0)

    await createAndImportFolderViaBrowser(folder1, 'e2eTest:GetMediaFoldersTool', testFolder)
    r = await mcpClient.getMediaFolders(ctx.clientCwd, ctx.mcpAddress)
    expect(r.folders.length).toEqual(1)
  })
})
