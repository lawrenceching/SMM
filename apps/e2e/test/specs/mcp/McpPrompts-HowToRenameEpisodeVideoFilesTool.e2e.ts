import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Prompts - HowToRenameEpisodeVideoFilesTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('HowToRenameEpisodeVideoFilesTool should return guideline markdown', async () => {
    const r = await mcpClient.howToRenameEpisodeVideoFiles(ctx.clientCwd, ctx.mcpAddress)
    expect(r.text).toContain('如何使用 SMM MCP tool 重命名媒体文件')
    expect(r.text).toContain('begin-rename-episode-video-file-task')
  })
})
