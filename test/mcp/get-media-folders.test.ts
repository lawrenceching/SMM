import { describe, expect, it } from 'bun:test'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { setupTestMediaFolders, writeUserConfig, folder1 } from './lib/testSetup'

describe('MCP AppData - GetMediaFoldersTool', () => {
  const ctx = useMcpServer()

  it('should return folders field, updated after import', async () => {
    let r = await callTool(ctx.url, 'get-media-folders')
    expect(r.isError).toBe(false)
    expect(r.structuredContent!.folders).toEqual([])

    const media = await setupTestMediaFolders()
    try {
      const folder = media.materialize(folder1)
      await writeUserConfig(ctx.userDataDir, { folders: [folder.path!] })

      r = await callTool(ctx.url, 'get-media-folders')
      expect(r.isError).toBe(false)
      expect(r.structuredContent!.folders).toEqual([folder.path!])
    } finally {
      await media.cleanup()
    }
  })
})
