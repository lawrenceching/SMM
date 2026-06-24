import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import type { MediaMetadata } from '@smm/core/types'
import { Path } from '@smm/core'
import mcpClient from '../../lib/McpClient'
import Prompts from '../../componentobjects/Prompts'
import TVShowPanel from '../../componentobjects/TVShowPanel.co'
import { expectMediaMetadataToBe, cleanup, setup } from '../../lib/testbed'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'

describe('MCP Other - RenameTaskFlow', () => {
  const ctx = createMcpSpecContext()

  beforeEach(async () => {
    await setup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
      openBrowserPage: true,
    })
    await setupMcpTest()
  })

  afterEach(async () => {
    await cleanupMcpTest()
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: false,
    })
  })

  it('MCP rename task tools should rename episode video file via begin/add/end flow', async () => {
    const folder = await createAndImportFolder(folder1, 'e2eTest:McpRenameTaskTools')
    await TVShowPanel.waitForTitleToBe(folder.translations?.title?.['en-US'] ?? 'N/A')

    expect(await TVShowPanel.toString()).toContain('S01E01 S01E01.mkv V V V')

    const r = await mcpClient.beginRenameFilesTask(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folder.path!,
    })

    await mcpClient.addRenameFileToTask(ctx.clientCwd, ctx.mcpAddress, {
      taskId: r.taskId,
      from: path.join(folder.path!, 'S01E01.mkv'),
      to: path.join(folder.path!, '[1].mp4'),
    })

    await mcpClient.endRenameFilesTask(ctx.clientCwd, ctx.mcpAddress, {
      taskId: r.taskId,
    })

    await Prompts.aiBasedRenamePrompt.waitForDisplayed()
    await browser.pause(1000)
    await Prompts.confirmButton.waitForClickable()
    await Prompts.confirmButton.click()
    await browser.pause(500)

    expect(await TVShowPanel.toString()).toContain('S01E01 [1].mp4 V V V')

    await expectMediaMetadataToBe(folder.path!, (obj) => {
      const mm = obj as MediaMetadata
      return (
        mm.mediaFiles?.length === 3 &&
        mm.mediaFiles?.[0]?.absolutePath === Path.posix(path.join(folder.path!, '[1].mp4'))
      )
    })
  })
})
