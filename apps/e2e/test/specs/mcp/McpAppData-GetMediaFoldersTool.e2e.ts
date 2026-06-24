import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { cleanup, setup } from '../../lib/testbed'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'

describe('MCP AppData - GetMediaFoldersTool', () => {
  const ctx = createMcpSpecContext()

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
  })

  it('GetMediaFoldersTool should return folders field', async () => {
    let r = await mcpClient.getMediaFolders(ctx.clientCwd, ctx.mcpAddress)
    expect(r.folders.length).toEqual(0)

    await createAndImportFolder(folder1, 'e2eTest:GetMediaFoldersTool')
    r = await mcpClient.getMediaFolders(ctx.clientCwd, ctx.mcpAddress)
    expect(r.folders.length).toEqual(1)
  })
})
