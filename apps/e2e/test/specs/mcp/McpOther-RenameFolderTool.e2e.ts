import { expect } from '@wdio/globals'
import * as path from 'node:path'
import * as fs from 'node:fs'
import type { MediaMetadata } from '@smm/core/types'
import mcpClient from '../../lib/McpClient'
import { expectMediaMetadataToBe, cleanup, setup } from '../../lib/testbed'
import { createAndImportFolder, folder1, folder2 } from '../../actions/import-folders'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from '../../lib/mcpSpecShared'
import TvShowPanelCO from 'test/componentobjects/TVShowPanel.co'
import Sidebar from 'test/componentobjects/Sidebar'
import { Path } from '@smm/core'

describe('MCP Other - RenameFolderTool', () => {
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

  it('TV Show', async () => {
    const folder = await createAndImportFolder(folder1, 'e2eTest:RenameFolderTool')

    // need to wait for media metadata to be saved in disk
    await browser.pause(4000);

    const newFolderName = `new-${folder.folderName}`
    const newFolderPath = path.join(path.dirname(folder.path!), newFolderName)
    const r = await mcpClient.renameFolder(ctx.clientCwd, ctx.mcpAddress, {
      from: folder.path!,
      to: newFolderPath,
    })
    expect(r.renamed).toBe(true)
    expect(r.from).toBe(folder.path!)
    expect(r.to).toBe(newFolderPath)

    await browser.pause(5000);

    await expectMediaMetadataToBe(newFolderPath, (obj) => {
      const mm = obj as MediaMetadata
      expect(mm.tvShow).toBeDefined()
      return mm.mediaFolderPath === Path.posix(newFolderPath)
    })

    expect(fs.existsSync(newFolderPath)).toBe(true)
    expect(fs.statSync(newFolderPath).isDirectory()).toBe(true)

    expect(await Sidebar.getDisplayedFolderNames()).toContain(newFolderName)
  })

  it('Movie', async () => {
    const folder = await createAndImportFolder(folder2, 'e2eTest:RenameFolderTool')

    // need to wait for media metadata to be saved in disk
    await browser.pause(4000);

    const newFolderName = `new-${folder.folderName}`
    const newFolderPath = path.join(path.dirname(folder.path!), newFolderName)
    const r = await mcpClient.renameFolder(ctx.clientCwd, ctx.mcpAddress, {
      from: folder.path!,
      to: newFolderPath,
    })
    expect(r.renamed).toBe(true)
    expect(r.from).toBe(folder.path!)
    expect(r.to).toBe(newFolderPath)

    await browser.pause(5000);

    await expectMediaMetadataToBe(newFolderPath, (obj) => {
      const mm = obj as MediaMetadata
      expect(mm.movie).toBeDefined()
      return mm.mediaFolderPath === Path.posix(newFolderPath)
    })

    expect(fs.existsSync(newFolderPath)).toBe(true)
    expect(fs.statSync(newFolderPath).isDirectory()).toBe(true)

    expect(await Sidebar.getDisplayedFolderNames()).toContain(newFolderName)
  })
})
