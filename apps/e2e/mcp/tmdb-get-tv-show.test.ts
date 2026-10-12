import { describe, expect, test } from 'vitest'
import { useMcpServer } from './lib/useMcpServer'
import { writeUserConfig } from './lib/testSetup'
import {
  applyTmdbUserConfig,
  callTmdbTool,
  TV_TITLE_PATTERN,
  TV_TMDB_ID,
} from './lib/tmdbTestHelpers'

describe('MCP Other - TmdbGetTvShowTool', () => {
  const ctx = useMcpServer()

  test(
    'tmdb-get-tv-show returns series details',
    async () => {
      await writeUserConfig(ctx.userDataDir, applyTmdbUserConfig())
      const r = await callTmdbTool(ctx.url, 'tmdb-get-tv-show', {
        id: TV_TMDB_ID,
        language: 'zh-CN',
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.id).toBe(TV_TMDB_ID)
      expect(String(sc.name)).toMatch(TV_TITLE_PATTERN)
    },
    180_000,
  )
})
