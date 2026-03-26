import { expect } from '@wdio/globals'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'
import StatusBar from '../componentobjects/StatusBar'
import { createBeforeHook } from '../lib/testbed'
import { getMetadataDir } from '@smm/test'
import { delay } from 'es-toolkit'

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
})
