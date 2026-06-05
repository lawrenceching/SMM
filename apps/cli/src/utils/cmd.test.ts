/**
 * Tests for the framework-agnostic core in `utils/cmd.ts`. These exercise
 * the spawn lifecycle, log writing, progress parsing, and exit handling
 * without going through Hono, the HTTP route, or a real download.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  injectYtdlpProgressArgs,
  isYtdlpProgressJson,
  parseYtdlpProgressLine,
  resolveCommand,
  resolveSpawnArgsAndEnv,
  runCommand,
  enqueueYtDlpExecuteCmd,
  _resetYtDlpQueueForTests,
  type RunCommandSink,
  type YtdlpProgressData,
  type SystemEvent,
} from './cmd'
import { createCommandExecutionLogWriter } from '../route/commandExecutionLog'

// ─── resolveCommand ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  discoverFfmpeg: vi.fn(),
  discoverFfprobe: vi.fn(),
  discoverYtdlp: vi.fn(),
  discoverVideoCaptioner: vi.fn(),
  discoverQuickjs: vi.fn(),
  resolveSpawnEnvForVideoCaptioner: vi.fn(),
}))

vi.mock('./Ffmpeg', () => ({
  discoverFfmpeg: mocks.discoverFfmpeg,
  discoverFfprobe: mocks.discoverFfprobe,
}))
vi.mock('./Ytdlp', () => ({
  discoverYtdlp: mocks.discoverYtdlp,
}))
vi.mock('./VideoCaptioner', () => ({
  discoverVideoCaptioner: mocks.discoverVideoCaptioner,
  resolveSpawnEnvForVideoCaptioner: mocks.resolveSpawnEnvForVideoCaptioner,
}))
vi.mock('./QuickJS', () => ({
  discoverQuickjs: mocks.discoverQuickjs,
}))

describe('resolveCommand', () => {
  beforeEach(() => {
    mocks.discoverFfmpeg.mockReset()
    mocks.discoverFfprobe.mockReset()
    mocks.discoverYtdlp.mockReset()
    mocks.discoverVideoCaptioner.mockReset()
    mocks.discoverQuickjs.mockReset()
  })

  it('returns ok when the executable is found', async () => {
    mocks.discoverFfmpeg.mockResolvedValue('C:/ffmpeg.exe')
    const result = await resolveCommand('ffmpeg')
    expect(result).toEqual({ kind: 'ok', command: 'ffmpeg', executablePath: 'C:/ffmpeg.exe' })
  })

  it('returns not-found when the executable is missing', async () => {
    mocks.discoverYtdlp.mockResolvedValue(undefined)
    const result = await resolveCommand('yt-dlp')
    expect(result).toEqual({ kind: 'not-found', command: 'yt-dlp' })
  })
})

// ─── resolveSpawnArgsAndEnv ──────────────────────────────────────────────────

describe('resolveSpawnArgsAndEnv (yt-dlp)', () => {
  beforeEach(() => {
    mocks.discoverFfmpeg.mockReset().mockResolvedValue('C:/ffmpeg.exe')
  })

  it('injects --ffmpeg-location and --progress-template on yt-dlp downloads', async () => {
    const { args, env } = await resolveSpawnArgsAndEnv('yt-dlp', [
      '--output',
      '/tmp/%(title)s.%(ext)s',
      'https://example.com/v',
    ])
    expect(args).toContain('--ffmpeg-location')
    expect(args[args.indexOf('--ffmpeg-location') + 1]).toBe('C:/ffmpeg.exe')
    expect(args).toContain('--newline')
    expect(args).toContain('--progress-template')
    expect(args).toContain('https://example.com/v')
    // Pipe mode ⇒ PYTHONUNBUFFERED set; tty mode ⇒ not set.
    expect(env?.PYTHONUNBUFFERED).toBe('1')
  })

  it('skips --progress-template injection when the caller already provided one', async () => {
    const { args } = await resolveSpawnArgsAndEnv('yt-dlp', [
      '--output',
      '/tmp/%(title)s.%(ext)s',
      '--progress-template',
      '{"custom":true}',
      'https://example.com/v',
    ])
    // Caller's --progress-template is preserved, no second one injected.
    const ptCount = args.filter((a) => a === '--progress-template').length
    expect(ptCount).toBe(1)
    expect(args).toContain('{"custom":true}')
  })

  it('does not add --ffmpeg-location when the caller already passed it', async () => {
    const { args } = await resolveSpawnArgsAndEnv('yt-dlp', [
      '--output',
      '/tmp/%(title)s.%(ext)s',
      '--ffmpeg-location',
      '/custom/ffmpeg',
    ])
    expect(args.filter((a) => a === '--ffmpeg-location').length).toBe(1)
    expect(args[args.indexOf('--ffmpeg-location') + 1]).toBe('/custom/ffmpeg')
  })

  it('omits PYTHONUNBUFFERED in tty mode', async () => {
    const { env } = await resolveSpawnArgsAndEnv('yt-dlp', ['--output', '/tmp/x'], { tty: true })
    expect(env?.PYTHONUNBUFFERED).toBeUndefined()
  })
})

// ─── Progress JSON shape check ───────────────────────────────────────────────

describe('isYtdlpProgressJson', () => {
  it('accepts the canonical downloading line', () => {
    const line =
      '{"percent": "42.3", "speed": "1234567", "eta": 42, "downloaded": 5242880, "total": 104857600, "status": "downloading"}'
    expect(isYtdlpProgressJson(line)).toBe(true)
  })
  it('rejects a line missing status', () => {
    expect(isYtdlpProgressJson('{"foo":"bar"}')).toBe(false)
  })
  it('rejects a non-JSON prefix', () => {
    expect(isYtdlpProgressJson('[download] Destination: foo.mp4')).toBe(false)
  })
})

describe('parseYtdlpProgressLine', () => {
  it('parses a fully populated line', () => {
    const line =
      '{"percent": "42.3", "speed": "1234567", "eta": 42, "downloaded": 5242880, "total": 104857600, "status": "downloading"}'
    expect(parseYtdlpProgressLine(line)).toEqual({
      percent: 42.3,
      speed: 1234567,
      eta: 42,
      downloaded: 5242880,
      total: 104857600,
      status: 'downloading',
    })
  })
  it('strips the % suffix from _percent_json values', () => {
    const line =
      '{"percent": "42.5%", "speed": "1234567", "eta": 42, "downloaded": 5242880, "total": 104857600, "status": "downloading"}'
    expect(parseYtdlpProgressLine(line)?.percent).toBe(42.5)
  })
  it('falls back to downloaded/total when percent is NA', () => {
    const line =
      '{"percent": "NA", "speed": "1234567", "eta": 42, "downloaded": 5242880, "total": 104857600, "status": "downloading"}'
    const r = parseYtdlpProgressLine(line)
    expect(r?.percent).toBeCloseTo((5242880 / 104857600) * 100, 5)
  })
  it('returns eta=null when unquoted NA is sanitized', () => {
    const line =
      '{"percent": "NA", "speed": "NA", "eta": NA, "downloaded": 1024, "total": 572853052, "status": "downloading"}'
    expect(parseYtdlpProgressLine(line)?.eta).toBeNull()
  })
})

// ─── runCommand end-to-end against a fake binary ────────────────────────────

describe('runCommand — pipe spawn lifecycle (using ffmpeg-style command)', () => {
  let prevLogDir: string | undefined
  let tmpLogRoot: string

  beforeEach(() => {
    prevLogDir = process.env.LOG_DIR
    tmpLogRoot = mkdtempSync(path.join(tmpdir(), 'smm-cmdrun-'))
    process.env.LOG_DIR = tmpLogRoot
    // Reset ffmpeg discovery so it doesn't pollute yt-dlp-arg injection.
    mocks.discoverFfmpeg.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => {
    if (prevLogDir === undefined) delete process.env.LOG_DIR
    else process.env.LOG_DIR = prevLogDir
    if (existsSync(tmpLogRoot)) rmSync(tmpLogRoot, { recursive: true, force: true })
  })

  it('writes stdout lines to the cmdLog and emits sink events for a non-yt-dlp command', async () => {
    const cmdLog = await createCommandExecutionLogWriter()
    const events: { type: string; data: unknown }[] = []
    const sink: Partial<RunCommandSink> = {
      stdout: (line) => events.push({ type: 'stdout', data: line }),
      stderr: (text) => events.push({ type: 'stderr', data: text }),
      progress: (data: YtdlpProgressData) => events.push({ type: 'progress', data }),
      system: (e: SystemEvent) => events.push({ type: 'system', data: e }),
    }

    // ffmpeg command: no args injection, no progress template injection.
    // node prints "hello" then exits. PTY is not used here.
    const result = await runCommand({
      executablePath: process.execPath,
      command: 'ffmpeg',
      args: ['-e', 'console.log("hello"); process.exit(0);'],
      cmdLog,
      timeoutMs: 5000,
      sink,
    })
    expect(result.ok).toBe(true)
    expect(result.usePty).toBe(false)

    // Wait for the spawned process to finish writing.
    await new Promise((r) => setTimeout(r, 500))

    const logContent = readFileSync(cmdLog.logFilePath, 'utf8')
    expect(logContent).toContain('[SYSTEM]')
    expect(logContent).toContain('hello')
    expect(logContent).toMatch(/exit code=0 signal=null/)

    // Sink events: stdout received the body, system received exit.
    const stdoutEvents = events.filter((e) => e.type === 'stdout')
    expect(stdoutEvents.length).toBeGreaterThanOrEqual(1)
    const exitEvents = events.filter((e) => e.type === 'system')
    expect(exitEvents.some((e) => (e.data as SystemEvent).event === 'exit')).toBe(true)
  })

  it('emits timeout system event when the deadline elapses', async () => {
    const cmdLog = await createCommandExecutionLogWriter()
    const events: SystemEvent[] = []
    const sink: Partial<RunCommandSink> = {
      system: (e) => events.push(e),
    }

    // Long-running node script: prints a line every 200ms and never exits.
    const longScript = `setInterval(() => console.log('tick'), 200)`

    await runCommand({
      executablePath: process.execPath,
      command: 'ffmpeg',
      args: ['-e', longScript],
      cmdLog,
      timeoutMs: 500,
      sink,
    })
    await new Promise((r) => setTimeout(r, 1500))
    expect(events.some((e) => e.event === 'timeout')).toBe(true)
  })
})

// ─── yt-dlp queueing ─────────────────────────────────────────────────────────

describe('enqueueYtDlpExecuteCmd', () => {
  beforeEach(() => _resetYtDlpQueueForTests())

  it('serializes yt-dlp tasks', async () => {
    const order: string[] = []
    const a = enqueueYtDlpExecuteCmd(async () => {
      await new Promise((r) => setTimeout(r, 30))
      order.push('a')
      return 'a'
    })
    const b = enqueueYtDlpExecuteCmd(async () => {
      order.push('b')
      return 'b'
    })
    await Promise.all([a, b])
    expect(order).toEqual(['a', 'b'])
  })
})

// ─── injectYtdlpProgressArgs ─────────────────────────────────────────────────

describe('injectYtdlpProgressArgs', () => {
  it('does nothing for non-download invocations (no --output)', () => {
    const args = ['-j', 'https://example.com/p']
    expect(injectYtdlpProgressArgs(args)).toBe(args)
  })
  it('injects --newline + --progress-template for download invocations', () => {
    const out = injectYtdlpProgressArgs(['--output', '/tmp/x', 'https://example.com/v'])
    expect(out).toContain('--newline')
    expect(out).toContain('--progress-template')
  })
})
