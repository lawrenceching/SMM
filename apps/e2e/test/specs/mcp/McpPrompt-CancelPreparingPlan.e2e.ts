import { expect, browser } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import Prompts from '../../componentobjects/Prompts'
import TVShowPanel from '../../componentobjects/TVShowPanel.co'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { cleanup, setup } from '../../lib/testbed'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'

describe('MCP Prompt - Cancel Preparing Plan', () => {
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

  it('should show AI rename prompt after begin and dismiss it on cancel', async () => {
    const folder = await createAndImportFolder(folder1, 'e2eTest:CancelPreparingRenamePlan')
    // folder1 is initialized via TMDB (tmdbid in folder name); TV panel shows the English TMDB title.
    await TVShowPanel.waitForTitleToBe(folder.translations?.title?.['en-US'] ?? 'N/A')
    // Step 1: begin-rename-files-task creates a plan in "preparing" status.
    // The begin tool does NOT broadcast a Socket.IO event, so the UI will
    // not discover the plan until it refreshes.
    await mcpClient.beginRenameFilesTask(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folder.path!,
    })

    // Step 3: verify the AI rename prompt appears (generating/spinner state).
    await Prompts.aiBasedRenamePrompt.waitForDisplayed({ timeout: 15000 })
    await browser.pause(500)
    expect(await Prompts.aiBasedRenamePrompt.getText()).toBeTruthy()

    // Step 4: click the Cancel button to reject the preparing plan.
    await Prompts.cancelButton.waitForClickable({ timeout: 5000 })
    await Prompts.cancelButton.click()

    // Step 5: the prompt should disappear.
    await browser.pause(1000)
    await expect(Prompts.aiBasedRenamePrompt).not.toBeDisplayed()
  })
})
