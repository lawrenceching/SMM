import { expect } from '@wdio/globals'
import * as path from 'node:path'
import * as os from 'node:os'
import mcpClient from '../../lib/McpClient'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { cleanup, setup } from '../../lib/testbed'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'

describe('MCP Other - IsFolderExistTool', () => {
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

  it('IsFolderExistTool should return exists=true for existing folder', async () => {
    const inexistentPath = path.join(os.tmpdir(), `smm-mcp-inexistent-${Date.now()}`)
    let r = await mcpClient.isFolderExist(ctx.clientCwd, ctx.mcpAddress, { path: inexistentPath })
    expect(r.exists).toBe(false)
    expect(r.path).toBe(inexistentPath)

    await createAndImportFolder(folder1, 'e2eTest:IsFolderExistTool')

    r = await mcpClient.isFolderExist(ctx.clientCwd, ctx.mcpAddress, { path: folder1.path! })
    expect(r.exists).toBe(true)
    expect(r.path).toBe(folder1.path!)
  })
})
