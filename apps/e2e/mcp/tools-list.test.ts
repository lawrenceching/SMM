import { describe, expect, test } from 'bun:test'
import { EXPECTED_MCP_TOOL_NAMES } from './expectedTools'
import { listTools } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'

describe('MCP tools/list', () => {
  const ctx = useMcpServer()

  test('returns the exact expected tool name set', async () => {
    const names = await listTools(ctx.url)
    const actual = [...names].sort()
    const expected = [...EXPECTED_MCP_TOOL_NAMES].sort()
    expect(actual).toEqual(expected)
  })
})
