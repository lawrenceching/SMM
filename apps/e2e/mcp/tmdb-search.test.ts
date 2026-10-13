import { describe, expect, test } from 'vitest'
import { useMcpServer } from './lib/useMcpServer'
import { writeUserConfig } from './lib/testSetup'
import {
  applyTmdbUserConfig,
  callTmdbTool,
  TV_SEARCH_KEYWORD,
  TV_TITLE_PATTERN,
} from './lib/tmdbTestHelpers'

describe('MCP Other - TmdbSearchTool', () => {
  const ctx = useMcpServer()

  test(
    'tmdb-search returns TV results',
    async () => {
      if (!ctx.isRemote) {
        await writeUserConfig(ctx.userDataDir, applyTmdbUserConfig())
      }
      const r = await callTmdbTool(ctx.url, 'tmdb-search', {
        keyword: TV_SEARCH_KEYWORD,
        type: 'tv',
        language: 'zh-CN',
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect((sc.results as unknown[]).length).toBeGreaterThan(0)
      expect(sc.page).toBeGreaterThanOrEqual(1)

      const first = (sc.results as Array<{ id: number; name?: string }>)[0]!
      expect(first.id).toBeGreaterThan(0)
      expect(first.name).toMatch(TV_TITLE_PATTERN)
    },
    180_000,
  )
})
