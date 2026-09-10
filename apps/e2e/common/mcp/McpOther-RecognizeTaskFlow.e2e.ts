import { expect, browser } from '@wdio/globals'
import type { MediaMetadata } from '@smm/types'
import { Path } from '@smm/utils/path'
import mcpClient from 'test/lib/McpClient'
import Prompts from 'test/componentobjects/Prompts'
import { TvShowPanelCO as TVShowPanel } from 'test/componentobjects/TVShowPanel.co'
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

  it('MCP create recognize episode plan tool should recognize an episode video file', async () => {
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

    const created = await mcpClient.createRecognizeEpisodePlan(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folderPath,
      files: [
        {
          season: 1,
          episode: 1,
          path: joinPlatformPath(folderPath, '[1].mp4'),
        },
      ],
    })
    expect(typeof created.planId).toBe('string')
    expect(created.planId.length).toBeGreaterThan(0)
    expect(typeof created.message).toBe('string')

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
