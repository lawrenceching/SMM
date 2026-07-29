import { expect, browser } from '@wdio/globals'
import type { MediaMetadata } from '@smm/core/types'
import { Path } from '@smm/core'
import mcpClient from 'test/lib/McpClient'
import { testbedOs } from 'test/lib/e2e-platform'
import {
  expectMediaMetadataViaBrowser,
  cleanup,
  setup,
} from 'test/lib/testbed'
import { folder1, folder2 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import {
  clearFolderViaBrowser,
  joinPlatformPath,
  listFilesViaBrowser,
  basenamePlatformPath,
  resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import {
  cleanupMcpTest,
  createMcpSpecContext,
  seedRecognizedMovieFolder,
  seedRecognizedTvShowFolder,
  setupMcpTest,
  skipIfOhos,
} from 'test/lib/mcpSpecShared'

/**
 * @supports local, Electron, Docker
 * @unsupported HarmonyOS
 */
describe('MCP Other - RenameFolderTool', () => {
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

  it('TV Show', async () => {
    const folderPath = await seedRecognizedTvShowFolder({ ...folder1 }, testFolder)

    const newFolderName = `new-${folder1.folderName}`
    const newFolderPath = joinPlatformPath(testFolder, newFolderName)
    const r = await mcpClient.renameFolder(ctx.clientCwd, ctx.mcpAddress, {
      from: folderPath,
      to: newFolderPath,
    })
    expect(r.renamed).toBe(true)
    expect(r.from).toBe(folderPath)
    expect(r.to).toBe(newFolderPath)

    await browser.pause(2000)

    await expectMediaMetadataViaBrowser(newFolderPath, (obj) => {
      const mm = obj as MediaMetadata
      expect(mm.tvShow).toBeDefined()
      return mm.mediaFolderPath === Path.posix(newFolderPath)
    })

    expect(await listFilesViaBrowser(testFolder).then((items) =>
      items.some(
        (item) => item.isDirectory && basenamePlatformPath(item.path) === newFolderName,
      ),
    )).toBe(true)
    expect(await Sidebar.getDisplayedFolderNames()).toContain(newFolderName)
  })

  it('Movie', async () => {
    const folderPath = await seedRecognizedMovieFolder(
      { ...folder2 },
      testFolder,
      {
        database: 'TMDB',
        id: '1311031',
        name: folder2.translations?.title?.['en-US'] ?? folder2.mediaName!,
      },
    )

    const newFolderName = `new-${folder2.folderName}`
    const newFolderPath = joinPlatformPath(testFolder, newFolderName)
    const r = await mcpClient.renameFolder(ctx.clientCwd, ctx.mcpAddress, {
      from: folderPath,
      to: newFolderPath,
    })
    expect(r.renamed).toBe(true)
    expect(r.from).toBe(folderPath)
    expect(r.to).toBe(newFolderPath)

    await browser.pause(2000)

    await expectMediaMetadataViaBrowser(newFolderPath, (obj) => {
      const mm = obj as MediaMetadata
      expect(mm.movie).toBeDefined()
      return mm.mediaFolderPath === Path.posix(newFolderPath)
    })

    expect(await listFilesViaBrowser(testFolder).then((items) =>
      items.some(
        (item) => item.isDirectory && basenamePlatformPath(item.path) === newFolderName,
      ),
    )).toBe(true)
    expect(await Sidebar.getDisplayedFolderNames()).toContain(newFolderName)
  })
})
