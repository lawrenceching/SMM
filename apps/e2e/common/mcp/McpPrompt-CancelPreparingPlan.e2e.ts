import { expect, browser } from '@wdio/globals'
import mcpClient from 'test/lib/McpClient'
import Prompts from 'test/componentobjects/Prompts'
import { folder1 } from 'test/actions/import-folders'
import { cleanup, setup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'
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
describe('MCP Prompt - Cancel Pending Plan', () => {
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

  it('should show the pending AI rename prompt and dismiss it on cancel', async () => {
    const folderPath = await seedRecognizedTvShowFolder({ ...folder1 }, testFolder)

    await mcpClient.createRenameEpisodePlan(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folderPath,
      files: [
        {
          from: joinPlatformPath(folderPath, 'S01E01.mkv'),
          to: joinPlatformPath(folderPath, '[1].mp4'),
        },
      ],
    })

    await Prompts.aiBasedRenamePrompt.waitForDisplayed({ timeout: 15000 })
    await browser.pause(500)
    expect(await Prompts.aiBasedRenamePrompt.getText()).toBeTruthy()

    await Prompts.cancelButton.waitForClickable({ timeout: 5000 })
    await Prompts.cancelButton.click()

    await browser.pause(1000)
    await expect(Prompts.aiBasedRenamePrompt).not.toBeDisplayed()
  })
})
