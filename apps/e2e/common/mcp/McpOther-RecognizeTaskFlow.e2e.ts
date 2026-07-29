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
import { folder1, type TestFolder } from 'test/actions/import-folders'
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
describe('MCP Other - RecognizeTaskFlow', () => {
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

  it('MCP recognize task tools should recognize episode video file via begin/add/end flow', async () => {
    const folder: TestFolder = {
      ...folder1,
      files: ['[1].mp4'],
    }
    const folderPath = await seedRecognizedTvShowFolder(folder, testFolder, (mm) => {
      mm.mediaFiles = []
      return mm
    })

    await TVShowPanel.waitForTable()
    await browser.waitUntil(async () => (await TVShowPanel.toString()).includes('S01E01 - - - -'), {
      timeout: 20000,
      interval: 500,
    })
    await expectMediaMetadataViaBrowser(folderPath, (obj) => {
      const mm = obj as MediaMetadata
      return mm.mediaFiles === undefined || mm.mediaFiles.length === 0
    })

    const begin = await mcpClient.beginRecognizeTask(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folderPath,
    })
    expect(begin.success).toBe(true)
    expect(typeof begin.taskId).toBe('string')
    expect(begin.taskId.length).toBeGreaterThan(0)

    const add = await mcpClient.addRecognizedFile(ctx.clientCwd, ctx.mcpAddress, {
      taskId: begin.taskId,
      season: 1,
      episode: 1,
      path: joinPlatformPath(folderPath, '[1].mp4'),
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
    await expectMediaMetadataViaBrowser(folderPath, (obj) => {
      const mm = obj as MediaMetadata
      const mf = mm.mediaFiles?.[0]
      return (
        (mm.mediaFiles?.length ?? 0) > 0 &&
        mf?.seasonNumber === 1 &&
        mf?.episodeNumber === 1 &&
        mf?.absolutePath === Path.posix(joinPlatformPath(folderPath, '[1].mp4'))
      )
    })
  })
})
