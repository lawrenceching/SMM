import { expect, browser } from '@wdio/globals'
import type { MediaMetadata } from '@smm/core/types'
import { Path } from '@smm/core'
import mcpClient from 'test/lib/McpClient'
import Prompts from 'test/componentobjects/Prompts'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'
import { testbedOs } from 'test/lib/e2e-platform'
import {
  expectMediaMetadataViaBrowser,
  cleanup,
  setup,
} from 'test/lib/testbed'
import { folder1 } from 'test/actions/import-folders'
import {
  clearFolderViaBrowser,
  joinPlatformPath,
  resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  seedRecognizedTvShowFolder,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

/**
 * @supports local, Electron, Docker
 * @unsupported HarmonyOS
 */
describe('MCP Other - RenameTaskFlow', () => {
  const ctx = createMcpSpecContext()
  let testFolder = ''

  before(function () {
    skipIfOhos(this)
  })

  beforeEach(async () => {
    await setup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: true,
      openBrowserPage: true,
      os: testbedOs,
    })
    await setupMcpTest()

    testFolder = await resolveSmmTestFolderViaBrowser()
    await clearFolderViaBrowser(testFolder)
  })

  afterEach(async () => {
    await cleanupMcpTest()
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: false,
      os: testbedOs,
    })
    if (testFolder) {
      await clearFolderViaBrowser(testFolder)
    }
  })

  it('MCP rename task tools should rename episode video file via begin/add/end flow', async () => {
    const folderPath = await seedRecognizedTvShowFolder({ ...folder1 }, testFolder)

    expect(await TVShowPanel.toString()).toContain('S01E01 S01E01.mkv V V V')

    const r = await mcpClient.beginRenameFilesTask(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folderPath,
    })

    await mcpClient.addRenameFileToTask(ctx.clientCwd, ctx.mcpAddress, {
      taskId: r.taskId,
      from: joinPlatformPath(folderPath, 'S01E01.mkv'),
      to: joinPlatformPath(folderPath, '[1].mp4'),
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

    await expectMediaMetadataViaBrowser(folderPath, (obj) => {
      const mm = obj as MediaMetadata
      return (
        mm.mediaFiles?.length === 3 &&
        mm.mediaFiles?.[0]?.absolutePath ===
          Path.posix(joinPlatformPath(folderPath, '[1].mp4'))
      )
    })
  })
})
