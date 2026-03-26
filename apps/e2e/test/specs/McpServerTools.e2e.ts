import { expect, browser } from '@wdio/globals'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'
import StatusBar from '../componentobjects/StatusBar'
import { createBeforeHook, expectMediaMetadataToBe } from '../lib/testbed'
import { getMetadataDir } from '@smm/test'
import { delay } from 'es-toolkit'
import Prompts from '../componentobjects/Prompts'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import TVShowPanel from '../componentobjects/TVShowPanel.co'
import { createFolderInTestFolder, folder1 } from '../actions/import-folders'
import type { MediaMetadata } from '@smm/core/types'
import { Path } from '@smm/core'

const execFileAsync = promisify(execFile)

async function execMcpTestClient(
  clientCwd: string,
  env: NodeJS.ProcessEnv,
  toolName: string,
  args?: Record<string, unknown>,
): Promise<{ stdout: string; stderr: string }> {
  // Use a login shell to pick up user PATH (bun is often installed via ~/.bun/bin).
  // This is more robust than trying to guess bun's absolute path in the WDIO runner env.
  const argsFlag = args ? ` --args '${JSON.stringify(args)}'` : ''
  return await execFileAsync(
    '/bin/bash',
    ['-lc', `cd "${clientCwd}" && bun index.ts --tool ${toolName}${argsFlag}`],
    { env, timeout: 30_000 },
  )
}

async function runToolWithRetries(
  clientCwd: string,
  mcpAddress: string,
  toolName: string,
  args?: Record<string, unknown>,
): Promise<{ stdout: string; stderr: string }> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const env = {
        ...process.env,
        SMM_MCP_URL: mcpAddress,
      }
      return await execMcpTestClient(clientCwd, env, toolName, args)
    } catch (err) {
      lastErr = err
      // MCP server can take a short time to become ready.
      await delay(1000)
    }
  }
  throw lastErr
}

async function ensureMcpPopoverOpen(): Promise<void> {
  const isOpen = await StatusBar.isMcpPopoverOpen()
  if (!isOpen) {
    await StatusBar.clickMcpToggle()
  }
  const opened = await StatusBar.waitForMcpPopover(5000)
  expect(opened).toBe(true)
}

function extractJsonObjectFromStdout(stdout: string): Record<string, unknown> {
  const first = stdout.indexOf('{')
  const last = stdout.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) {
    throw new Error(`Unable to parse JSON from stdout: ${stdout}`)
  }
  return JSON.parse(stdout.slice(first, last + 1)) as Record<string, unknown>
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
    const res = await runToolWithRetries(clientCwd, mcpAddress, 'readme')
    const stdout = res.stdout ?? ''
    const stderr = res.stderr ?? ''

    // Keep stderr for debugging, but do not require it to be empty.
    if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

    expect(stdout).toContain('Simple Media Manager (SMM)')
    expect(stdout).toContain('## 核心概念')
  })

  it('GetApplicationContextTool should return context fields', async function () {
    const res = await runToolWithRetries(clientCwd, mcpAddress, 'get-app-context')
    const stdout = res.stdout ?? ''
    const stderr = res.stderr ?? ''

    if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

    expect(stdout).toContain('"selectedMediaFolder"')
    expect(stdout).toContain('"language"')
  })

  it('GetMediaFoldersTool should return folders field', async function () {
    const res = await runToolWithRetries(clientCwd, mcpAddress, 'get-media-folders')
    const stdout = res.stdout ?? ''
    const stderr = res.stderr ?? ''

    if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

    expect(stdout).toContain('"folders"')
  })

  it('IsFolderExistTool should return exists=true for existing folder', async function () {
    const testDir = path.join(os.tmpdir(), `smm-mcp-exist-${Date.now()}`)
    fs.mkdirSync(testDir, { recursive: true })
    try {
      const res = await runToolWithRetries(clientCwd, mcpAddress, 'is-folder-exist', {
        path: testDir,
      })
      const stdout = res.stdout ?? ''
      const stderr = res.stderr ?? ''

      if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

      expect(stdout).toContain('"exists": true')
      expect(stdout).toContain('"path"')
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
      const res = await runToolWithRetries(clientCwd, mcpAddress, 'list-files', {
        folderPath: testDir,
        videoFileOnly: false,
      })
      const stdout = res.stdout ?? ''
      const stderr = res.stderr ?? ''

      if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

      expect(stdout).toContain('"files"')
      expect(stdout).toContain('"count"')
      expect(stdout).toContain('a.txt')
      expect(stdout).toContain('b.mp4')
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('HowToRenameEpisodeVideoFilesTool should return guideline markdown', async function () {
    const res = await runToolWithRetries(
      clientCwd,
      mcpAddress,
      'how-to-rename-episode-video-files',
    )
    const stdout = res.stdout ?? ''
    const stderr = res.stderr ?? ''

    if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

    expect(stdout).toContain('如何使用 SMM MCP tool 重命名媒体文件')
    expect(stdout).toContain('begin-rename-episode-video-file-task')
  })

  it('HowToRecognizeEpisodeVideoFilesTool should return guideline markdown', async function () {
    const res = await runToolWithRetries(
      clientCwd,
      mcpAddress,
      'how-to-recognize-episode-video-files',
    )
    const stdout = res.stdout ?? ''
    const stderr = res.stderr ?? ''

    if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

    expect(stdout).toContain('如何使用 SMM MCP tool 识别季集视频文件')
    expect(stdout).toContain('begin-recognize-task')
  })

  it('RenameFolderTool should rename folder in file system', async function () {
    // Use an isolated temp root for this case only, so rename side-effects
    // cannot impact other MCP tool tests.
    const isolatedRoot = path.join(os.tmpdir(), `smm-mcp-rename-${Date.now()}`)
    const fromDir = path.join(isolatedRoot, 'from-folder')
    const toDir = path.join(isolatedRoot, 'to-folder')
    fs.mkdirSync(fromDir, { recursive: true })
    fs.writeFileSync(path.join(fromDir, 'keep.txt'), 'keep', 'utf8')

    try {
      // rename-folder currently expects source metadata cache file to exist.
      const metadataDir = await getMetadataDir()
      const toSafeFileName = (folderPath: string) =>
        folderPath.replace(/[\/\\:?*|<>"]/g, '_')
      fs.mkdirSync(metadataDir, { recursive: true })
      const fromMetadataPath = path.join(metadataDir, `${toSafeFileName(fromDir)}.json`)
      fs.writeFileSync(fromMetadataPath, '{}', 'utf8')

      const res = await runToolWithRetries(clientCwd, mcpAddress, 'rename-folder', {
        from: fromDir,
        to: toDir,
      })
      const stdout = res.stdout ?? ''
      const stderr = res.stderr ?? ''

      if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

      expect(stdout).toContain('"renamed": true')
      expect(fs.existsSync(fromDir)).toBe(false)
      expect(fs.existsSync(toDir)).toBe(true)
      expect(fs.existsSync(path.join(toDir, 'keep.txt'))).toBe(true)
    } finally {
      const metadataDir = await getMetadataDir()
      const toSafeFileName = (folderPath: string) =>
        folderPath.replace(/[\/\\:?*|<>"]/g, '_')
      fs.rmSync(path.join(metadataDir, `${toSafeFileName(fromDir)}.json`), { force: true })
      fs.rmSync(path.join(metadataDir, `${toSafeFileName(toDir)}.json`), { force: true })
      fs.rmSync(fromDir, { recursive: true, force: true })
      fs.rmSync(toDir, { recursive: true, force: true })
      fs.rmSync(isolatedRoot, { recursive: true, force: true })
    }
  })

  it('GetMediaMetadataTool should return cached metadata for folder', async function () {
    const mediaFolder = path.join(os.tmpdir(), `smm-mcp-metadata-${Date.now()}`)
    fs.mkdirSync(mediaFolder, { recursive: true })

    const metadataDir = await getMetadataDir()
    const toSafeFileName = (folderPath: string) =>
      folderPath.replace(/[\/\\:?*|<>"]/g, '_')
    const metadataFilePath = path.join(metadataDir, `${toSafeFileName(mediaFolder)}.json`)

    const metadata = {
      mediaFolderPath: mediaFolder,
      type: 'tvshow-folder',
      tmdbTvShow: {
        id: 12345,
        name: 'E2E Metadata Show',
        seasons: [
          {
            season_number: 1,
            name: 'Season 1',
            episodes: [
              {
                season_number: 1,
                episode_number: 1,
                name: 'Episode 1',
              },
            ],
          },
        ],
      },
    }

    try {
      fs.mkdirSync(metadataDir, { recursive: true })
      fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf8')

      const res = await runToolWithRetries(clientCwd, mcpAddress, 'get-media-metadata', {
        mediaFolderPath: mediaFolder,
      })
      const stdout = res.stdout ?? ''
      const stderr = res.stderr ?? ''

      if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

      expect(stdout).toContain('"mediaFolderPath"')
      expect(stdout).toContain('"type": "tvshow-folder"')
      expect(stdout).toContain('"tmdbId": 12345')
      expect(stdout).toContain('"name": "E2E Metadata Show"')
      expect(stdout).toContain('"episodeName": "Episode 1"')
    } finally {
      fs.rmSync(metadataFilePath, { force: true })
      fs.rmSync(mediaFolder, { recursive: true, force: true })
    }
  })

  it('MCP rename task tools should rename episode video file via begin/add/end flow', async function () {
    const folder = createFolderInTestFolder({
      ...folder1,
      files: ['S01E01.mp4'],
    })
    const mediaFolder = folder.path as string
    const fromFile = path.join(mediaFolder, 'S01E01.mp4')
    const toFile = path.join(mediaFolder, '[1].mp4')

    try {
      await Menu.importMediaFolder({
        type: 'tvshow',
        folderPathInPlatformFormat: mediaFolder,
        traceId: 'e2eTest:McpRenameTaskTools',
      })
      await Sidebar.waitForFolder(folder.mediaName as string, 60000)
      await TVShowPanel.waitForTable()
      await browser.waitUntil(
        async () => (await TVShowPanel.toString()).includes('S01E01 S01E01.mp4'),
        { timeout: 10000, interval: 500 },
      )
      await expectMediaMetadataToBe(mediaFolder, (obj) => {
        const mm = obj as MediaMetadata
        const mf = mm.mediaFiles?.[0]
        return (
          (mm.mediaFiles?.length ?? 0) > 0 &&
          mf?.seasonNumber === 1 &&
          mf?.episodeNumber === 1 &&
          mf?.absolutePath === Path.posix(fromFile)
        )
      })

      const beginRes = await runToolWithRetries(
        clientCwd,
        mcpAddress,
        'begin-rename-episode-video-file-task',
        { mediaFolderPath: mediaFolder },
      )
      const beginStdout = beginRes.stdout ?? ''
      const beginStderr = beginRes.stderr ?? ''
      if (beginStderr) console.log(`mcp-test-client stderr: ${beginStderr}`)
      const beginObj = extractJsonObjectFromStdout(beginStdout)
      const taskId = beginObj.taskId
      expect(typeof taskId).toBe('string')
      expect((taskId as string).length).toBeGreaterThan(0)

      const addRes = await runToolWithRetries(
        clientCwd,
        mcpAddress,
        'add-rename-episode-video-file',
        {
          taskId: taskId as string,
          from: fromFile,
          to: toFile,
        },
      )
      const addStdout = addRes.stdout ?? ''
      const addStderr = addRes.stderr ?? ''
      if (addStderr) console.log(`mcp-test-client stderr: ${addStderr}`)
      expect(addStdout).toContain('"success": true')

      const endRes = await runToolWithRetries(
        clientCwd,
        mcpAddress,
        'end-rename-episode-video-file-task',
        { taskId: taskId as string },
      )
      const endStdout = endRes.stdout ?? ''
      const endStderr = endRes.stderr ?? ''
      if (endStderr) console.log(`mcp-test-client stderr: ${endStderr}`)
      expect(endStdout).toContain('"success": true')

      // End tool emits a rename plan; apply it via the UI prompt.
      await Prompts.aiBasedRenamePrompt.waitForDisplayed({ timeout: 10000 })
      await Prompts.confirmButton.click()

      // Wait for the async rename plan execution to finish.
      await browser.waitUntil(
        async () => fs.existsSync(toFile) && !fs.existsSync(fromFile),
        { timeout: 60000, interval: 500 },
      )
      expect(fs.existsSync(fromFile)).toBe(false)
      expect(fs.existsSync(toFile)).toBe(true)
    } finally {
      fs.rmSync(fromFile, { force: true })
      fs.rmSync(toFile, { force: true })
      fs.rmSync(mediaFolder, { recursive: true, force: true })
    }
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

      const beginRes = await runToolWithRetries(
        clientCwd,
        mcpAddress,
        'begin-recognize-task',
        { mediaFolderPath: mediaFolder },
      )
      const beginStdout = beginRes.stdout ?? ''
      const beginStderr = beginRes.stderr ?? ''
      if (beginStderr) console.log(`mcp-test-client stderr: ${beginStderr}`)
      const beginObj = extractJsonObjectFromStdout(beginStdout)
      const taskId = beginObj.taskId
      expect(typeof taskId).toBe('string')
      expect((taskId as string).length).toBeGreaterThan(0)

      const addRes = await runToolWithRetries(
        clientCwd,
        mcpAddress,
        'add-recognized-file',
        {
          taskId: taskId as string,
          season: 1,
          episode: 1,
          path: recognizedFile,
        },
      )
      const addStdout = addRes.stdout ?? ''
      const addStderr = addRes.stderr ?? ''
      if (addStderr) console.log(`mcp-test-client stderr: ${addStderr}`)
      expect(addStdout).toContain('"success": true')

      const endRes = await runToolWithRetries(clientCwd, mcpAddress, 'end-recognize-task', {
        taskId: taskId as string,
      })
      const endStdout = endRes.stdout ?? ''
      const endStderr = endRes.stderr ?? ''
      if (endStderr) console.log(`mcp-test-client stderr: ${endStderr}`)
      expect(endStdout).toContain('"success": true')

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

      const res = await runToolWithRetries(clientCwd, mcpAddress, 'get-episode', {
        mediaFolderPath: mediaFolder,
        season: 1,
        episode: 1,
      })
      const stdout = res.stdout ?? ''
      const stderr = res.stderr ?? ''
      if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

      expect(stdout).toContain('"videoFilePath"')
      expect(stdout).toContain('S01E01.mp4')
      expect(stdout).toContain('"season": 1')
      expect(stdout).toContain('"episode": 1')
      expect(stdout).toContain('"message": "succeeded"')

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

      const res = await runToolWithRetries(clientCwd, mcpAddress, 'get-episodes', {
        mediaFolderPath: mediaFolder,
      })
      const stdout = res.stdout ?? ''
      const stderr = res.stderr ?? ''
      if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

      expect(stdout).toContain('"episodes"')
      expect(stdout).toContain('"showName"')
      expect(stdout).toContain('"totalCount"')
      expect(stdout).toContain('"season": 1')
      expect(stdout).toContain('"episode": 1')
      expect(stdout).toContain('S01E01.mp4')
    } finally {
      fs.rmSync(videoFilePath, { force: true })
      fs.rmSync(mediaFolder, { recursive: true, force: true })
      fs.rmSync(isolatedRoot, { recursive: true, force: true })
    }
  })

  it('TmdbSearchTool should return search results', async function () {
    const res = await runToolWithRetries(clientCwd, mcpAddress, 'tmdb-search', {
      keyword: '天使降临到我身边',
      type: 'tv',
      language: 'zh-CN',
    })
    const stdout = res.stdout ?? ''
    const stderr = res.stderr ?? ''
    if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

    expect(stdout).toContain('"results"')
    expect(stdout).toContain('"total_results"')
  })

  it('TmdbGetMovieTool should return movie details by id', async function () {
    const res = await runToolWithRetries(clientCwd, mcpAddress, 'tmdb-get-movie', {
      id: 552524,
      language: 'zh-CN',
    })
    const stdout = res.stdout ?? ''
    const stderr = res.stderr ?? ''
    if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

    expect(stdout).toContain('"id": 552524')
    expect(stdout).toContain('"title"')
  })

  it('TmdbGetTvShowTool should return tv show details by id', async function () {
    const res = await runToolWithRetries(clientCwd, mcpAddress, 'tmdb-get-tv-show', {
      id: 84666,
      language: 'zh-CN',
    })
    const stdout = res.stdout ?? ''
    const stderr = res.stderr ?? ''
    if (stderr) console.log(`mcp-test-client stderr: ${stderr}`)

    expect(stdout).toContain('"id": 84666')
    expect(stdout).toContain('"seasons"')
  })
})
