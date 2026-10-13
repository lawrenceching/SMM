import { describe, expect, test } from 'vitest'
import { join } from 'node:path'
import { callTool } from './lib/mcpInspectorClient'
import { seedMediaFolderForTarget } from './lib/remoteFixtures'
import { useMcpServer } from './lib/useMcpServer'
import { folder1 } from './lib/testSetup'

describe('MCP Other - ListFilesTool', () => {
  const ctx = useMcpServer()

  test('should list files from target folder', async () => {
    const seeded = await seedMediaFolderForTarget(ctx, folder1)
    try {
      const r = await callTool(ctx.url, 'list-files', {
        folderPath: seeded.path,
        recursive: false,
        filter: undefined,
        videoFileOnly: false,
      })
      expect(r.isError).toBe(false)

      const expectedFilePaths = folder1.files.map((file) =>
        ctx.isRemote ? `${seeded.path}/${file}` : join(seeded.path, file),
      )
      expect(r.structuredContent!.files).toHaveLength(expectedFilePaths.length)
      expect([...(r.structuredContent!.files as string[])].sort()).toEqual(
        [...expectedFilePaths].sort(),
      )
    } finally {
      await seeded.cleanup()
    }
  })
})
