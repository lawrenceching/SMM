import { expect, browser } from '@wdio/globals'
import mcpClient from '../../lib/McpClient'
import Prompts from '../../componentobjects/Prompts'
import TVShowPanel from '../../componentobjects/TVShowPanel.co'
import { createAndImportFolder, folder1 } from '../../actions/import-folders'
import { createMcpSpecContext, registerMcpHooks } from '../../lib/mcpSpecShared'

describe('MCP Prompt - Cancel Preparing Plan', () => {
  const ctx = createMcpSpecContext()
  registerMcpHooks()

  it('should show AI rename prompt after begin and dismiss it on cancel', async () => {
    const folder = await createAndImportFolder(folder1, 'e2eTest:CancelPreparingRenamePlan')
    // Use mediaName (the native title) since the app may display it in
    // the OS locale (e.g. zh-CN). The translations table is fallback.
    await TVShowPanel.waitForTitleToBe(folder.mediaName ?? 'N/A')
    // Step 1: begin-rename-files-task creates a plan in "preparing" status.
    // The begin tool does NOT broadcast a Socket.IO event, so the UI will
    // not discover the plan until it refreshes.
    await mcpClient.beginRenameFilesTask(ctx.clientCwd, ctx.mcpAddress, {
      mediaFolderPath: folder.path!,
    })

    // Step 2: refresh the page to force the plans query to pick up
    // the new "preparing" plan.
    await browser.refresh()
    await TVShowPanel.waitForTitleToBe(folder.mediaName ?? 'N/A')

    // Step 3: verify the AI rename prompt appears (generating/spinner state).
    await Prompts.aiBasedRenamePrompt.waitForDisplayed({ timeout: 15000 })
    await browser.pause(500)
    expect(await Prompts.aiBasedRenamePrompt.getText()).toBeTruthy()

    // Step 4: click the Cancel button to reject the preparing plan.
    // The AiBasedRenameFilePrompt renders children, so the
    // data-testid="floating-prompt-cancel-button" wrapper is NOT
    // present. Find the cancel <button> by its text content instead.
    const cancelBtn = await $('button=取消')
    await cancelBtn.waitForClickable({ timeout: 5000 })
    await cancelBtn.click()

    // Step 5: the prompt should disappear.
    await browser.pause(1000)
    await expect(Prompts.aiBasedRenamePrompt).not.toBeDisplayed()
  })
})
