import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import { folder1, seedRecognizedTvShowFolder } from './lib/testSetup'

describe('MCP Other - GetEpisodesTool', () => {
  const ctx = useMcpServer()

  test('should return episodes list with mapped video path', async () => {
    const seeded = await seedRecognizedTvShowFolder(ctx, { ...folder1 })
    try {
      const r = await callTool(ctx.url, 'get-episodes', {
        mediaFolderPath: seeded.path,
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.totalCount).toEqual(13)
      expect(sc.showName).toBeTruthy()
      expect(sc.numberOfSeasons).toEqual(2)
    } finally {
      await seeded.cleanup()
    }
  })
})
