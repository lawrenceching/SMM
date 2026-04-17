import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import Sidebar from '../../componentobjects/Sidebar'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Other - GetEpisodeTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('GetEpisodeTool should return mapped video file path', async () => {
    const folder = await createAndImportFolder(folder1, 'e2eTest:McpGetEpisodeTool')
    await Sidebar.waitForFolderName(folder1.folderName, 2000)

    // need to wait for media metadata to be saved in disk
    await browser.pause(4000);

    const r = await mcpClient.getEpisode(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folder.path!,
      season: 1,
      episode: 1,
    })
    expect(r.message).toBe('succeeded')
    expect(r.season).toBe(1)
    expect(r.episode).toBe(1)
    expect(r.videoFilePath).toContain('S01E01.mkv')
  })
})
