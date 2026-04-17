import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import TVShowPanel from '../../componentobjects/TVShowPanel.co'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Other - GetMediaMetadataTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('GetMediaMetadataTool should return cached metadata for folder', async () => {
    const folder = await createAndImportFolder(folder1, 'e2eTest:GetMediaMetadataTool')
    await TVShowPanel.waitForTitleToBe(folder1.translations?.title?.['en-US'] ?? 'N/A')

    const r = await mcpClient.getMediaMetadata(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folder.path!,
    })
    const json = JSON.stringify(r)
    expect(json).toContain(folder.mediaName!)
  })
})
