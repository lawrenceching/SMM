import { describe, expect, it } from 'bun:test'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'

describe('MCP Prompts - HowToRecognizeEpisodeVideoFilesTool', () => {
  const ctx = useMcpServer()

  it('should return guideline markdown', async () => {
    const r = await callTool(ctx.url, 'how-to-recognize-episode-video-files')
    expect(r.isError).toBe(false)
    expect(r.structuredContent!.text).toContain('如何使用 SMM MCP tool 识别季集视频文件')
    expect(r.structuredContent!.text).toContain('begin-recognize-task')
  })
})
