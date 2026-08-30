import { describe, expect, it } from 'bun:test'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'

describe('MCP Prompts - HowToRenameEpisodeVideoFilesTool', () => {
  const ctx = useMcpServer()

  it('should return guideline markdown', async () => {
    const r = await callTool(ctx.url, 'how-to-rename-episode-video-files')
    expect(r.isError).toBe(false)
    expect(r.structuredContent!.text).toContain('如何使用 SMM MCP tool 重命名媒体文件')
    expect(r.structuredContent!.text).toContain('begin-rename-episode-video-file-task')
  })
})
