import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'
import StatusBar from '../componentobjects/StatusBar'
import { createBeforeHook, expectMediaMetadataToBe } from '../lib/testbed'
import mcpClient from '../lib/McpClient'
import { getMetadataDir } from '@smm/test'
import { delay } from 'es-toolkit'
import Prompts from '../componentobjects/Prompts'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import TVShowPanel from '../componentobjects/TVShowPanel.co'
import { createAndImportFolder, createFolderInTestFolder, folder1 } from '../actions/import-folders'
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
  before(createBeforeHook())
  const repoRoot = path.resolve(process.cwd(), '..', '..')
  const clientCwd = path.resolve(repoRoot, 'test/mcp-test-client')
  let mcpAddress = ''

  beforeEach(async () => {
    await ensureMcpPopoverOpen()

    // Enable MCP server and capture the runtime address for each test.
    await StatusBar.clickMcpSwitch()
    await delay(1000)

    mcpAddress = await StatusBar.getMcpAddress()
    expect(mcpAddress).toContain('http://')
  })

  afterEach(async () => {
    // Ensure MCP server is turned off to avoid leaking state to next test.
    await ensureMcpPopoverOpen()
    await StatusBar.clickMcpSwitch()
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
    const r = await mcpClient.getMediaFolders(clientCwd, mcpAddress)
    expect(Array.isArray(r.folders)).toBe(true)
  })

  it('IsFolderExistTool should return exists=true for existing folder', async function () {
    const testDir = path.join(os.tmpdir(), `smm-mcp-exist-${Date.now()}`)
    fs.mkdirSync(testDir, { recursive: true })
    try {
      const r = await mcpClient.isFolderExist(clientCwd, mcpAddress, { path: testDir })
      expect(r.exists).toBe(true)
      expect(r.path).toBeTruthy()
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('ListFilesTool should list files from target folder', async function () {
    const testDir = path.join(os.tmpdir(), `smm-mcp-list-${Date.now()}`)
    fs.mkdirSync(testDir, { recursive: true })
    const fileA = path.join(testDir, 'a.txt')
    const fileB = path.join(testDir, 'b.mp4')
    fs.writeFileSync(fileA, 'a', 'utf8')
    fs.writeFileSync(fileB, 'b', 'utf8')

    try {
      const r = await mcpClient.listFiles(clientCwd, mcpAddress, {
        folderPath: testDir,
        videoFileOnly: false,
      })
      expect(r.count).toBeGreaterThanOrEqual(2)
      const joined = r.files.join('\n')
      expect(joined).toContain('a.txt')
      expect(joined).toContain('b.mp4')
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
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
    const isolatedRoot = path.join(os.tmpdir(), `smm-mcp-rename-${Date.now()}`)
    const fromDir = path.join(isolatedRoot, 'from-folder')
    const toDir = path.join(isolatedRoot, 'to-folder')
    fs.mkdirSync(fromDir, { recursive: true })
    fs.writeFileSync(path.join(fromDir, 'keep.txt'), 'keep', 'utf8')

    try {
      const metadataDir = await getMetadataDir()
      const toSafeFileName = (folderPath: string) => folderPath.replace(/[\/\\:?*|<>"]/g, '_')
      fs.mkdirSync(metadataDir, { recursive: true })
      const fromMetadataPath = path.join(metadataDir, `${toSafeFileName(Path.posix(fromDir))}.json`)
      fs.writeFileSync(fromMetadataPath, '{}', 'utf8')

      const r = await mcpClient.renameFolder(clientCwd, mcpAddress, {
        from: fromDir,
        to: toDir,
      })
      expect(r.renamed).toBe(true)
      expect(fs.existsSync(fromDir)).toBe(false)
      expect(fs.existsSync(toDir)).toBe(true)
      expect(fs.existsSync(path.join(toDir, 'keep.txt'))).toBe(true)
    } finally {
      const metadataDir = await getMetadataDir()
      const toSafeFileName = (folderPath: string) => folderPath.replace(/[\/\\:?*|<>"]/g, '_')
      fs.rmSync(path.join(metadataDir, `${toSafeFileName(Path.posix(fromDir))}.json`), { force: true })
      fs.rmSync(path.join(metadataDir, `${toSafeFileName(Path.posix(toDir))}.json`), { force: true })
      fs.rmSync(fromDir, { recursive: true, force: true })
      fs.rmSync(toDir, { recursive: true, force: true })
      fs.rmSync(isolatedRoot, { recursive: true, force: true })
    }
  })

  it('GetMediaMetadataTool should return cached metadata for folder', async function () {
    const folder = await createAndImportFolder(folder1, 'e2eTest:GetMediaMetadataTool')
    await TVShowPanel.waitForTitleToBe(folder.mediaName!)

    const r = await mcpClient.getMediaMetadata(clientCwd, mcpAddress, {
      mediaFolderPath: folder.path!,
    })
    const json = JSON.stringify(r)
    expect(json).toContain(folder.mediaName!)
  })

  it.only('MCP rename task tools should rename episode video file via begin/add/end flow', async function () {
    const folder = await createAndImportFolder(folder1, 'e2eTest:McpRenameTaskTools')
    await TVShowPanel.waitForTitleToBe(folder.mediaName!)

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

    await TVShowPanel.floatingPrompt.waitForDisplayed()
  })

  it('MCP recognize task tools should recognize episode video file via begin/add/end flow', async function () {
    const isolatedRoot = path.join(os.tmpdir(), `smm-mcp-recognize-task-${Date.now()}`)
    const mediaFolder = path.join(isolatedRoot, folder1.folderName)
    fs.mkdirSync(mediaFolder, { recursive: true })
    const recognizedFile = path.join(mediaFolder, '[1].mp4')
    fs.writeFileSync(recognizedFile, 'video-content', 'utf8')

    try {
      await Menu.importMediaFolder({
        type: 'tvshow',
        folderPathInPlatformFormat: mediaFolder,
        traceId: 'e2eTest:McpRecognizeTaskTools',
      })
      await Sidebar.waitForFolder(folder1.mediaName as string, 60000)
      await TVShowPanel.waitForTable()
      await browser.waitUntil(
        async () => (await TVShowPanel.toString()).includes('S01E01 - - - -'),
        { timeout: 20000, interval: 500 },
      )
      await expectMediaMetadataToBe(mediaFolder, (obj) => {
        const mm = obj as MediaMetadata
        return mm.mediaFiles === undefined || mm.mediaFiles.length === 0
      })

      const begin = await mcpClient.beginRecognizeTask(clientCwd, mcpAddress, {
        mediaFolderPath: mediaFolder,
      })
      expect(begin.success).toBe(true)
      expect(typeof begin.taskId).toBe('string')
      expect(begin.taskId.length).toBeGreaterThan(0)

      const add = await mcpClient.addRecognizedFile(clientCwd, mcpAddress, {
        taskId: begin.taskId,
        season: 1,
        episode: 1,
        path: recognizedFile,
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
      await expectMediaMetadataToBe(mediaFolder, (obj) => {
        const mm = obj as MediaMetadata
        const mf = mm.mediaFiles?.[0]
        return (
          (mm.mediaFiles?.length ?? 0) > 0 &&
          mf?.seasonNumber === 1 &&
          mf?.episodeNumber === 1 &&
          mf?.absolutePath === Path.posix(recognizedFile)
        )
      })
    } finally {
      fs.rmSync(recognizedFile, { force: true })
      fs.rmSync(mediaFolder, { recursive: true, force: true })
      fs.rmSync(isolatedRoot, { recursive: true, force: true })
    }
  })

  it('GetEpisodeTool should return mapped video file path', async function () {
    const isolatedRoot = path.join(os.tmpdir(), `smm-mcp-get-episode-${Date.now()}`)
    const mediaFolder = path.join(isolatedRoot, folder1.folderName)
    fs.mkdirSync(mediaFolder, { recursive: true })
    const expectedVideoPath = path.join(mediaFolder, 'S01E01.mp4')
    fs.writeFileSync(expectedVideoPath, 'video-content', 'utf8')

    try {
      await Menu.importMediaFolder({
        type: 'tvshow',
        folderPathInPlatformFormat: mediaFolder,
        traceId: 'e2eTest:McpGetEpisodeTool',
      })
      await Sidebar.waitForFolder(folder1.mediaName as string, 60000)
      await expectMediaMetadataToBe(mediaFolder, (obj) => {
        const mm = obj as MediaMetadata
        const mf = mm.mediaFiles?.[0]
        return (
          (mm.mediaFiles?.length ?? 0) > 0 &&
          mf?.seasonNumber === 1 &&
          mf?.episodeNumber === 1 &&
          mf?.absolutePath === Path.posix(expectedVideoPath)
        )
      })

      const r = await mcpClient.getEpisode(clientCwd, mcpAddress, {
        mediaFolderPath: mediaFolder,
        season: 1,
        episode: 1,
      })
      expect(r.message).toBe('succeeded')
      expect(r.season).toBe(1)
      expect(r.episode).toBe(1)
      expect(r.videoFilePath).toContain('S01E01.mp4')

      await expectMediaMetadataToBe(mediaFolder, (obj) => {
        const mm = obj as MediaMetadata
        const mf = mm.mediaFiles?.[0]
        return mf?.absolutePath === Path.posix(expectedVideoPath)
      })
    } finally {
      fs.rmSync(expectedVideoPath, { force: true })
      fs.rmSync(mediaFolder, { recursive: true, force: true })
      fs.rmSync(isolatedRoot, { recursive: true, force: true })
    }
  })

  it('GetEpisodesTool should return episodes list with mapped video path', async function () {
    const isolatedRoot = path.join(os.tmpdir(), `smm-mcp-get-episodes-${Date.now()}`)
    const mediaFolder = path.join(isolatedRoot, folder1.folderName)
    fs.mkdirSync(mediaFolder, { recursive: true })
    const videoFilePath = path.join(mediaFolder, 'S01E01.mp4')
    fs.writeFileSync(videoFilePath, 'video-content', 'utf8')

    try {
      await Menu.importMediaFolder({
        type: 'tvshow',
        folderPathInPlatformFormat: mediaFolder,
        traceId: 'e2eTest:McpGetEpisodesTool',
      })
      await Sidebar.waitForFolder(folder1.mediaName as string, 60000)
      await expectMediaMetadataToBe(mediaFolder, (obj) => {
        const mm = obj as MediaMetadata
        const mf = mm.mediaFiles?.[0]
        return (
          (mm.mediaFiles?.length ?? 0) > 0 &&
          mf?.seasonNumber === 1 &&
          mf?.episodeNumber === 1 &&
          mf?.absolutePath === Path.posix(videoFilePath)
        )
      })

      const r = await mcpClient.getEpisodes(clientCwd, mcpAddress, {
        mediaFolderPath: mediaFolder,
      })
      expect(r.totalCount).toBeGreaterThan(0)
      expect(r.showName).toBeTruthy()
      expect(typeof r.numberOfSeasons).toBe('number')
      const ep = r.episodes.find((e) => e.season === 1 && e.episode === 1)
      expect(ep?.videoFilePath).toContain('S01E01.mp4')
    } finally {
      fs.rmSync(videoFilePath, { force: true })
      fs.rmSync(mediaFolder, { recursive: true, force: true })
      fs.rmSync(isolatedRoot, { recursive: true, force: true })
    }
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
    expect(r).toHaveProperty('title')
  })

  it('TmdbGetTvShowTool should return tv show details by id', async function () {
    const r = await mcpClient.tmdbGetTvShow(clientCwd, mcpAddress, {
      id: 84666,
      language: 'zh-CN',
    })
    expect(r.id).toBe(84666)
    expect(Array.isArray(r.seasons as unknown[])).toBe(true)
  })
})
