import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { seedForTarget } from './lib/remoteFixtures'
import { useMcpServer } from './lib/useMcpServer'
import { folder1 } from './lib/testSetup'

describe('MCP Other - GetMediaMetadataTool', () => {
  const ctx = useMcpServer()

  test('should return cached metadata for folder', async () => {
    const seeded = await seedForTarget(ctx, { ...folder1 }, (mm) => {
      if (mm.tvShow) {
        mm.tvShow.name = folder1.mediaName!
      }
      return mm
    })
    try {
      const r = await callTool(ctx.url, 'get-media-metadata', {
        mediaFolderPath: seeded.path,
      })
      expect(r.isError).toBe(false)
      const json = JSON.stringify(r.structuredContent)
      expect(json).toContain(folder1.mediaName!)
    } finally {
      await seeded.cleanup()
    }
  })
})
