import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { setupTestMediaFolders, folder1 } from './lib/testSetup'

describe('MCP Other - ListFilesTool', () => {
  const ctx = useMcpServer()

  it('should list files from target folder', async () => {
    const media = await setupTestMediaFolders()
    try {
      const folder = media.materialize(folder1)

      const r = await callTool(ctx.url, 'list-files', {
        folderPath: folder.path!,
        recursive: false,
        filter: undefined,
        videoFileOnly: false,
      })
      expect(r.isError).toBe(false)

      const expectedFilePaths = folder1.files.map((file) => join(folder.path!, file))
      expect(r.structuredContent!.files).toHaveLength(expectedFilePaths.length)
      expect([...r.structuredContent!.files].sort()).toEqual([...expectedFilePaths].sort())
    } finally {
      await media.cleanup()
    }
  })
})
