import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { setupTestMediaFolders, folder1 } from './lib/testSetup'

describe('MCP Other - IsFolderExistTool', () => {
  const ctx = useMcpServer()

  it('should return exists=false then exists=true', async () => {
    const media = await setupTestMediaFolders()
    try {
      const folder = media.materialize(folder1)

      const inexistentPath = join(media.mediaDir, `smm-mcp-inexistent-${Date.now()}`)
      let r = await callTool(ctx.url, 'is-folder-exist', { path: inexistentPath })
      expect(r.isError).toBe(false)
      expect(r.structuredContent!.exists).toBe(false)
      expect(r.structuredContent!.path).toBe(inexistentPath)

      r = await callTool(ctx.url, 'is-folder-exist', { path: folder.path! })
      expect(r.isError).toBe(false)
      expect(r.structuredContent!.exists).toBe(true)
      expect(r.structuredContent!.path).toBe(folder.path!)
    } finally {
      await media.cleanup()
    }
  })
})
