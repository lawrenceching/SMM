import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { seedForTarget } from './lib/remoteFixtures'
import { useMcpServer } from './lib/useMcpServer'
import { folder1 } from './lib/testSetup'

describe('MCP Other - GetEpisodeTool', () => {
  const ctx = useMcpServer()

  test('should return mapped video file path', async () => {
    const seeded = await seedForTarget(ctx, { ...folder1 })
    try {
      const r = await callTool(ctx.url, 'get-episode', {
        mediaFolderPath: seeded.path,
        season: 1,
        episode: 1,
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.message).toBe('succeeded')
      expect(sc.season).toBe(1)
      expect(sc.episode).toBe(1)
      expect(sc.videoFilePath).toContain('S01E01.mkv')
    } finally {
      await seeded.cleanup()
    }
  })
})
