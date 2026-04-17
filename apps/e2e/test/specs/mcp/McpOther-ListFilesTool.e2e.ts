import { expect } from '@wdio/globals'
import { expect as expectChai } from 'chai'
import * as path from 'node:path'
import mcpClient from '../../lib/McpClient'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Other - ListFilesTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('ListFilesTool should list files from target folder', async () => {
    const folder = await createAndImportFolder(folder1, 'e2eTest:ListFilesTool')
    const r = await mcpClient.listFiles(ctx.clientCwd, ctx.mcpAddress, {
      folderPath: folder.path!,
      recursive: false,
      filter: undefined,
      videoFileOnly: false,
    })

    const expectedFilePaths = folder.files.map((file) => path.join(folder.path!, file))
    expectChai(r.files).to.have.deep.members(expectedFilePaths)
  })
})
