import { describe, expect, test } from 'vitest'
import path from 'node:path'
import { callTool } from './lib/mcpInspectorClient'
import { seedMediaFolderForTarget } from './lib/remoteFixtures'
import { useMcpServer } from './lib/useMcpServer'
import { folder1 } from './lib/testSetup'

describe('MCP Other - IsFolderExistTool', () => {
  const ctx = useMcpServer()

  test('should return exists=false then exists=true', async () => {
    const seeded = await seedMediaFolderForTarget(ctx, folder1)
    try {
      const parent = ctx.isRemote
        ? path.posix.dirname(seeded.path)
        : path.dirname(seeded.path)
      const inexistentPath = ctx.isRemote
        ? path.posix.join(parent, `smm-mcp-inexistent-${Date.now()}`)
        : path.join(parent, `smm-mcp-inexistent-${Date.now()}`)

      let r = await callTool(ctx.url, 'is-folder-exist', { path: inexistentPath })
      expect(r.isError).toBe(false)
      expect(r.structuredContent!.exists).toBe(false)
      expect(r.structuredContent!.path).toBe(inexistentPath)

      r = await callTool(ctx.url, 'is-folder-exist', { path: seeded.path })
      expect(r.isError).toBe(false)
      expect(r.structuredContent!.exists).toBe(true)
      expect(r.structuredContent!.path).toBe(seeded.path)
    } finally {
      await seeded.cleanup()
    }
  })
})
