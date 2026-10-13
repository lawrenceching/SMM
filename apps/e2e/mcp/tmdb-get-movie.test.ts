import { describe, expect, test } from 'vitest'
import { useMcpServer } from './lib/useMcpServer'
import { writeUserConfig } from './lib/testSetup'
import { applyTmdbUserConfig, callTmdbTool, MOVIE_TMDB_ID } from './lib/tmdbTestHelpers'

describe('MCP Other - TmdbGetMovieTool', () => {
  const ctx = useMcpServer()

  test(
    'tmdb-get-movie returns movie details',
    async () => {
      if (!ctx.isRemote) {
        await writeUserConfig(ctx.userDataDir, applyTmdbUserConfig())
      }
      const r = await callTmdbTool(ctx.url, 'tmdb-get-movie', {
        id: MOVIE_TMDB_ID,
        language: 'zh-CN',
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.id).toBe(MOVIE_TMDB_ID)
      expect(typeof sc.title).toBe('string')
      expect(String(sc.title).length).toBeGreaterThan(0)
    },
    180_000,
  )
})
