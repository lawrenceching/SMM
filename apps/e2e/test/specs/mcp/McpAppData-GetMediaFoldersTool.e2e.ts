import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP AppData - GetMediaFoldersTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('GetMediaFoldersTool should return folders field', async () => {
    let r = await mcpClient.getMediaFolders(ctx.clientCwd, ctx.mcpAddress)
    expect(r.folders.length).toEqual(0)

    await createAndImportFolder(folder1, 'e2eTest:GetMediaFoldersTool')
    r = await mcpClient.getMediaFolders(ctx.clientCwd, ctx.mcpAddress)
    expect(r.folders.length).toEqual(1)
  })
})
