import { describe, expect, test } from 'vitest'
import { callTool } from './lib/mcpInspectorClient'
import { seedMediaFolderForTarget } from './lib/remoteFixtures'
import { patchRemoteUserConfigFolders } from './lib/remoteHttp'
import { useMcpServer } from './lib/useMcpServer'
import { folder1, writeUserConfig } from './lib/testSetup'

describe('MCP AppData - GetMediaFoldersTool', () => {
  const ctx = useMcpServer()

  test('should return folders field, updated after import', async () => {
    if (ctx.isRemote) {
      await patchRemoteUserConfigFolders(ctx.httpServerAddress!, ctx.authToken!, [])
    }

    let r = await callTool(ctx.url, 'get-media-folders')
    expect(r.isError).toBe(false)
    expect(r.structuredContent!.folders).toEqual([])

    const seeded = await seedMediaFolderForTarget(ctx, folder1)
    try {
      if (ctx.isRemote) {
        await patchRemoteUserConfigFolders(ctx.httpServerAddress!, ctx.authToken!, [
          seeded.path,
        ])
      } else {
        await writeUserConfig(ctx.userDataDir, { folders: [seeded.path] })
      }

      r = await callTool(ctx.url, 'get-media-folders')
      expect(r.isError).toBe(false)
      expect(r.structuredContent!.folders).toEqual([seeded.path])
    } finally {
      await seeded.cleanup()
    }
  })
})
