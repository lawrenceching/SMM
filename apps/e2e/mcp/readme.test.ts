import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'

describe('MCP Server - ReadmeTool', () => {
  const ctx = useMcpServer()

  test('should return README markdown', async () => {
    const r = await callTool(ctx.url, 'readme')
    expect(r.isError).toBe(false)
    expect(r.structuredContent).not.toBeNull()
    expect(r.structuredContent!.text).toContain('Simple Media Manager (SMM)')
    expect(r.structuredContent!.text).toContain('## 核心概念')
  })
})
