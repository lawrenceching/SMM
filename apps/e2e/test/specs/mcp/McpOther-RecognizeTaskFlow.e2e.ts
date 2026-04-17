import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import type { MediaMetadata } from '@smm/core/types'
import { Path } from '@smm/core'
import mcpClient from '../../lib/McpClient'
import Prompts from '../../componentobjects/Prompts'
import Sidebar from '../../componentobjects/Sidebar'
import TVShowPanel from '../../componentobjects/TVShowPanel.co'
import { expectMediaMetadataToBe } from '../../lib/testbed'
import { createAndImportFolder, folder1, type TestFolder } from '../../actions/import-folders'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Other - RecognizeTaskFlow', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('MCP recognize task tools should recognize episode video file via begin/add/end flow', async () => {
    const folder = await createAndImportFolder(
      {
        ...folder1,
        files: ['[1].mp4'],
      } as TestFolder,
      'e2eTest:McpRecognizeTaskTools',
    )

    await Sidebar.waitForFolderName(folder1.folderName, 2000)
    await TVShowPanel.waitForTable()
    await browser.waitUntil(async () => (await TVShowPanel.toString()).includes('S01E01 - - - -'), {
      timeout: 20000,
      interval: 500,
    })
    await expectMediaMetadataToBe(folder.path!, (obj) => {
      const mm = obj as MediaMetadata
      return mm.mediaFiles === undefined || mm.mediaFiles.length === 0
    })

    const begin = await mcpClient.beginRecognizeTask(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folder.path!,
    })
    expect(begin.success).toBe(true)
    expect(typeof begin.taskId).toBe('string')
    expect(begin.taskId.length).toBeGreaterThan(0)

    const add = await mcpClient.addRecognizedFile(ctx.clientCwd, ctx.mcpAddress, {
      taskId: begin.taskId,
      season: 1,
      episode: 1,
      path: path.join(folder.path!, '[1].mp4'),
    })
    expect(add.success).toBe(true)

    const end = await mcpClient.endRecognizeTask(ctx.clientCwd, ctx.mcpAddress, {
      taskId: begin.taskId,
    })
    expect(end.success).toBe(true)

    await Prompts.aiBasedRecognizePrompt.waitForDisplayed({ timeout: 10000 })
    await Prompts.confirmButton.click()

    await browser.waitUntil(
      async () => (await TVShowPanel.toString()).includes('S01E01 [1].mp4 - - -'),
      { timeout: 15000, interval: 500 },
    )
    await expectMediaMetadataToBe(folder.path!, (obj) => {
      const mm = obj as MediaMetadata
      const mf = mm.mediaFiles?.[0]
      return (
        (mm.mediaFiles?.length ?? 0) > 0 &&
        mf?.seasonNumber === 1 &&
        mf?.episodeNumber === 1 &&
        mf?.absolutePath === Path.posix(path.join(folder.path!, '[1].mp4'))
      )
    })
  })
})
