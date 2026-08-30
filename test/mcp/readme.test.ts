import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { startMcpServer, type McpServerHandle } from './lib/mcpServer'
import { callTool } from './lib/mcpInspectorClient'

describe('MCP Server - ReadmeTool', () => {
  let server: McpServerHandle

  beforeAll(async () => {
    server = await startMcpServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  it('should return README markdown', async () => {
    const r = await callTool(server.url, 'readme')
    expect(r.isError).toBe(false)
    expect(r.structuredContent).not.toBeNull()
    expect(r.structuredContent!.text).toContain('Simple Media Manager (SMM)')
    expect(r.structuredContent!.text).toContain('## 核心概念')
  })
})
