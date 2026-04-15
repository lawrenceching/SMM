import { expect, browser } from '@wdio/globals'
import { expect as expectChai } from 'chai'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'
import StatusBar from '../componentobjects/StatusBar'
import { cleanup, setup, expectMediaMetadataToBe } from '../lib/testbed'
import mcpClient from '../lib/McpClient'
import { delay } from 'es-toolkit'
import Prompts from '../componentobjects/Prompts'
import Sidebar from '../componentobjects/Sidebar'
import TVShowPanel from '../componentobjects/TVShowPanel.co'
import { createAndImportFolder, createFolderInTestFolder, folder1, type TestFolder } from '../actions/import-folders'
import type { MediaMetadata } from '@smm/core/types'
import { Path } from '@smm/core'

async function ensureMcpPopoverOpen(): Promise<void> {
  const isOpen = await StatusBar.isMcpPopoverOpen()
  if (!isOpen) {
    await StatusBar.clickMcpToggle()
  }
  const opened = await StatusBar.waitForMcpPopover(5000)
  expect(opened).toBe(true)
}

describe('MCP Server Tools', () => {
  before(async () => {

    await setup({
      removeMetadataDir: false,
      removePlansDir: false,
      removeMediaFolders: false,
      removeDirInSidebar: false,
      resetUserConfig: false,
      openBrowserPage: true,
    });
    
    await ensureMcpPopoverOpen();

    await StatusBar.mcpSwitch.waitForDisplayed();

    if(!await StatusBar.isMcpToggleOn()) {
      console.log(`MCP server is not enabled, enabling it...`)
      await StatusBar.mcpSwitch.waitForClickable();

      // waitForClickable didn't work, have to wait
      await delay(500)
    
      await StatusBar.mcpSwitch.click();
      await delay(1000)
    } else {
      console.log(`MCP server is already enabled`)
    }

    await delay(1000)

    mcpAddress = await StatusBar.getMcpAddress()
    expect(mcpAddress).toContain('http://')
  })

  after(async () => {
    await ensureMcpPopoverOpen();
    await StatusBar.mcpSwitch.waitForDisplayed();

    if(await StatusBar.isMcpToggleOn()) {
      await StatusBar.mcpSwitch.click();
      await delay(1000)
    }
  })

  const repoRoot = path.resolve(process.cwd(), '..', '..')
  const clientCwd = path.resolve(repoRoot, 'test/mcp-test-client')
  let mcpAddress = ''

  afterEach(async () => {
    await cleanup({
      removeDirInSidebar: true,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      resetUserConfig: false,
    });

    await browser.refresh();
    await StatusBar.appVersion.waitForDisplayed();
  }) 

  it('ReadmeTool should return README markdown', async function () {
    const r = await mcpClient.readme(clientCwd, mcpAddress)
    expect(r.text).toContain('Simple Media Manager (SMM)')
    expect(r.text).toContain('## 核心概念')
  })

  it('GetApplicationContextTool should return context fields', async function () {
    const r = await mcpClient.getAppContext(clientCwd, mcpAddress)
    expect(r).toHaveProperty('selectedMediaFolder')
    expect(r).toHaveProperty('language')
  })

  it('GetMediaFoldersTool should return folders field', async function () {
    let r = await mcpClient.getMediaFolders(clientCwd, mcpAddress)
    expect(r.folders.length).toEqual(0)

    await createAndImportFolder(folder1, 'e2eTest:GetMediaFoldersTool')
    r = await mcpClient.getMediaFolders(clientCwd, mcpAddress)
    expect(r.folders.length).toEqual(1)
  })

  it('IsFolderExistTool should return exists=true for existing folder', async function () {
    const inexistentPath = path.join(os.tmpdir(), `smm-mcp-inexistent-${Date.now()}`)
    let r = await mcpClient.isFolderExist(clientCwd, mcpAddress, { path: inexistentPath })
    expect(r.exists).toBe(false)
    expect(r.path).toBe(inexistentPath)

    await createAndImportFolder(folder1, 'e2eTest:IsFolderExistTool')

    r = await mcpClient.isFolderExist(clientCwd, mcpAddress, { path: folder1.path! })
    expect(r.exists).toBe(true)
    expect(r.path).toBe(folder1.path!)
  })

  it('ListFilesTool should list files from target folder', async function () {
    const folder = await createAndImportFolder(folder1, 'e2eTest:ListFilesTool')
    const r = await mcpClient.listFiles(clientCwd, mcpAddress, { 
      folderPath: folder.path!,
      recursive: false,
      filter: undefined,
      videoFileOnly: false
    })
    
    const expectedFilePaths = folder.files.map((file) => path.join(folder.path!, file))
    expectChai(r.files).to.have.deep.members(expectedFilePaths)
  })

  it('HowToRenameEpisodeVideoFilesTool should return guideline markdown', async function () {
    const r = await mcpClient.howToRenameEpisodeVideoFiles(clientCwd, mcpAddress)
    expect(r.text).toContain('如何使用 SMM MCP tool 重命名媒体文件')
    expect(r.text).toContain('begin-rename-episode-video-file-task')
  })

  it('HowToRecognizeEpisodeVideoFilesTool should return guideline markdown', async function () {
    const r = await mcpClient.howToRecognizeEpisodeVideoFiles(clientCwd, mcpAddress)
    expect(r.text).toContain('如何使用 SMM MCP tool 识别季集视频文件')
    expect(r.text).toContain('begin-recognize-task')
  })

  it('RenameFolderTool should rename folder in file system', async function () {
    const folder = await createAndImportFolder(folder1, 'e2eTest:RenameFolderTool')
    const newFolderName = `new-${folder.folderName}`
    const newFolderPath = path.join(path.dirname(folder.path!), newFolderName)
    const r = await mcpClient.renameFolder(clientCwd, mcpAddress, {
      from: folder.path!,
      to: newFolderPath,
    })
    expect(r.renamed).toBe(true)
    expect(r.from).toBe(folder.path!)
    expect(r.to).toBe(newFolderPath)
    
    expectMediaMetadataToBe(newFolderPath, (obj) => {
      const mm = obj as MediaMetadata
      return mm.mediaFolderPath === newFolderPath
    })

    expect(fs.existsSync(newFolderPath)).toBe(true)
    expect(fs.statSync(newFolderPath).isDirectory()).toBe(true)
  })

  it('GetMediaMetadataTool should return cached metadata for folder', async function () {
    const folder = await createAndImportFolder(folder1, 'e2eTest:GetMediaMetadataTool')
    await TVShowPanel.waitForTitleToBe(folder1.translations?.title?.['en-US'] ?? "N/A")

    const r = await mcpClient.getMediaMetadata(clientCwd, mcpAddress, {
      mediaFolderPath: folder.path!,
    })
    const json = JSON.stringify(r)
    expect(json).toContain(folder.mediaName!)
  })

  it('MCP rename task tools should rename episode video file via begin/add/end flow', async function () {
    const folder = await createAndImportFolder(folder1, 'e2eTest:McpRenameTaskTools')
    await TVShowPanel.waitForTitleToBe(folder.translations?.title?.['en-US'] ?? "N/A")

    expect(await TVShowPanel.toString()).toContain('S01E01 S01E01.mkv V V V')

    const r = await mcpClient.beginRenameEpisodeVideoFileTask(clientCwd, mcpAddress, {
      mediaFolderPath: folder.path!,
    })

    const { taskId } = r
    
    await mcpClient.addRenameEpisodeVideoFile(clientCwd, mcpAddress, {
      taskId: taskId,
      from: path.join(folder.path!, 'S01E01.mkv'),
      to: path.join(folder.path!, '[1].mp4'),
    })

    await mcpClient.endRenameEpisodeVideoFileTask(clientCwd, mcpAddress, {
      taskId: taskId,
    })

    await Prompts.aiBasedRenamePrompt.waitForDisplayed();
    await browser.pause(1000);
    await Prompts.confirmButton.waitForClickable();
    await Prompts.confirmButton.click();

    await browser.pause(500);

    expect(await TVShowPanel.toString()).toContain('S01E01 [1].mp4 V V V')

    await expectMediaMetadataToBe(folder.path!, (obj) => {
      const mm = obj as MediaMetadata
      return mm.mediaFiles?.length === 3 && mm.mediaFiles?.[0]?.absolutePath === Path.posix(path.join(folder.path!, '[1].mp4'))
    })

  })

  it('MCP recognize task tools should recognize episode video file via begin/add/end flow', async function () {

    const folder = await createAndImportFolder({
      ...folder1,
      files: ['[1].mp4'],      
    } as TestFolder, 'e2eTest:McpRecognizeTaskTools')

    
    await Sidebar.waitForFolderName(folder1.folderName, 2000)
    await TVShowPanel.waitForTable()
    await browser.waitUntil(
      async () => (await TVShowPanel.toString()).includes('S01E01 - - - -'),
      { timeout: 20000, interval: 500 },
    )
    await expectMediaMetadataToBe(folder.path!, (obj) => {
      const mm = obj as MediaMetadata
      return mm.mediaFiles === undefined || mm.mediaFiles.length === 0
    })

    const begin = await mcpClient.beginRecognizeTask(clientCwd, mcpAddress, {
      mediaFolderPath: folder.path!,
    })
    expect(begin.success).toBe(true)
    expect(typeof begin.taskId).toBe('string')
    expect(begin.taskId.length).toBeGreaterThan(0)

    const add = await mcpClient.addRecognizedFile(clientCwd, mcpAddress, {
      taskId: begin.taskId,
      season: 1,
      episode: 1,
      path: path.join(folder.path!, '[1].mp4'),
    })
    expect(add.success).toBe(true)

    const end = await mcpClient.endRecognizeTask(clientCwd, mcpAddress, {
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

  it('GetEpisodeTool should return mapped video file path', async function () {
    const folder = await createAndImportFolder(folder1, 'e2eTest:McpGetEpisodeTool')
    await Sidebar.waitForFolderName(folder1.folderName, 2000)

    const r = await mcpClient.getEpisode(clientCwd, mcpAddress, {
      mediaFolderPath: folder.path!,
      season: 1,
      episode: 1,
    })
    expect(r.message).toBe('succeeded')
    expect(r.season).toBe(1)
    expect(r.episode).toBe(1)
    expect(r.videoFilePath).toContain('S01E01.mkv')
  })

  it('GetEpisodesTool should return episodes list with mapped video path', async function () {
    const folder = await createAndImportFolder(folder1, 'e2eTest:McpGetEpisodesTool')
    await TVShowPanel.waitForTitleToBe(folder1.translations?.title?.['en-US'] ?? "N/A")

    const r = await mcpClient.getEpisodes(clientCwd, mcpAddress, {
        mediaFolderPath: folder.path!,
    })

    console.log(`GetEpisodesTool response: ${JSON.stringify(r, null, 2)}`)

    expect(r.totalCount).toEqual(13)
    expect(r.showName).toEqual(folder1.translations?.title?.['en-US'] ?? "N/A")
    expect(r.numberOfSeasons).toEqual(2)
  })

  it('TmdbSearchTool should return search results', async function () {
    const r = await mcpClient.tmdbSearch(clientCwd, mcpAddress, {
      keyword: '天使降临到我身边',
      type: 'tv',
      language: 'zh-CN',
    })
    expect(Array.isArray(r.results)).toBe(true)
    expect(r.total_results).toBeGreaterThan(0)
  })

  it('TmdbGetMovieTool should return movie details by id', async function () {
    const r = await mcpClient.tmdbGetMovie(clientCwd, mcpAddress, {
      id: 552524,
      language: 'zh-CN',
    })
    expect(r.id).toBe(552524)
  })

  it('TmdbGetTvShowTool should return tv show details by id', async function () {
    const r = await mcpClient.tmdbGetTvShow(clientCwd, mcpAddress, {
      id: 84666,
      language: 'zh-CN',
    })
    expect(r.data!.id).toBe(84666)
  })
})
