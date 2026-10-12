import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'

describe('MCP AppData - GetApplicationContextTool', () => {
  const ctx = useMcpServer()

  test('should return context fields', async () => {
    const r = await callTool(ctx.url, 'get-app-context')
    expect(r.isError).toBe(false)
    const sc = r.structuredContent!
    expect(sc).toHaveProperty('selectedMediaFolder')
    expect(sc).toHaveProperty('language')
  })
})
