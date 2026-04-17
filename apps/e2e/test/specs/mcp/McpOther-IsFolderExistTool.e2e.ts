import { expect } from '@wdio/globals'
import * as path from 'node:path'
import * as os from 'node:os'
import mcpClient from '../../lib/McpClient'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Other - IsFolderExistTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

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
