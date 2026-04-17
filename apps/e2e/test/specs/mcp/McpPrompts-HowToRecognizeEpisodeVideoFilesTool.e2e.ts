import { expect } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Prompts - HowToRecognizeEpisodeVideoFilesTool', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('HowToRecognizeEpisodeVideoFilesTool should return guideline markdown', async () => {
    const r = await mcpClient.howToRecognizeEpisodeVideoFiles(ctx.clientCwd, ctx.mcpAddress)
    expect(r.text).toContain('如何使用 SMM MCP tool 识别季集视频文件')
    expect(r.text).toContain('begin-recognize-task')
  })
})
