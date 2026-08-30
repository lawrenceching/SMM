import { describe, expect, it } from 'bun:test'
import { callTool } from './lib/mcpInspectorClient'
import { useMcpServer } from './lib/useMcpServer'
import {
  folder1,
  seedMediaMetadata,
  setupTestMediaFolders,
  writeUserConfig,
  type TestFolder,
} from './lib/testSetup'
import type { MediaMetadata } from '@smm/core/types'

const TV_SHOW_METADATA_TEMPLATE = '天使降临到我身边.metadata.json'

async function seedRecognizedTvShowFolder(
  ctx: { userDataDir: string; appDataDir: string },
  folder: TestFolder,
  updateMediaMetadata?: (mediaMetadata: MediaMetadata) => MediaMetadata,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const media = await setupTestMediaFolders()
  const created = media.materialize(folder)
  await writeUserConfig(ctx.userDataDir, { folders: [created.path!] })
  await seedMediaMetadata(ctx.appDataDir, created, TV_SHOW_METADATA_TEMPLATE, updateMediaMetadata)
  return { path: created.path!, cleanup: () => media.cleanup() }
}

describe('MCP Other - GetEpisodesTool', () => {
  const ctx = useMcpServer()

  it('should return episodes list with mapped video path', async () => {
    const seeded = await seedRecognizedTvShowFolder(ctx, { ...folder1 })
    try {
      const r = await callTool(ctx.url, 'get-episodes', {
        mediaFolderPath: seeded.path,
      })
      expect(r.isError).toBe(false)
      const sc = r.structuredContent!
      expect(sc.totalCount).toEqual(13)
      // showName comes from the seeded metadata template.
      expect(sc.showName).toBeTruthy()
      expect(sc.numberOfSeasons).toEqual(2)
    } finally {
      await seeded.cleanup()
    }
  })
})
