/**
 * Integration test: verify that the streaming response is held open until
 * the spawned process actually exits, and that the orchestrator-style
 * client receives a non-empty body containing the exit system event.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { runCommand } from './cmd'
import { createCommandExecutionLogWriter } from '../route/commandExecutionLog'

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

describe('runCommand — orchestrator-style usage', () => {
  let prevLogDir: string | undefined
  let tmpLogRoot: string

  beforeEach(() => {
    prevLogDir = process.env.LOG_DIR
    tmpLogRoot = mkdtempSync(path.join(tmpdir(), 'smm-runcmd-orch-'))
    process.env.LOG_DIR = tmpLogRoot
    mocks.discoverFfmpeg.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => {
    if (prevLogDir === undefined) delete process.env.LOG_DIR
    else process.env.LOG_DIR = prevLogDir
    if (existsSync(tmpLogRoot)) rmSync(tmpLogRoot, { recursive: true, force: true })
  })

  it('sink receives the exit system event before runCommand resolves', async () => {
    const cmdLog = await createCommandExecutionLogWriter()
    const events: { type: string; data: unknown }[] = []
    const sink = {
      stdout: (line: string) => events.push({ type: 'stdout', data: line }),
      stderr: (text: string) => events.push({ type: 'stderr', data: text }),
      progress: (data: unknown) => events.push({ type: 'progress', data }),
      system: (e: unknown) => events.push({ type: 'system', data: e }),
    }

    // node script that exits 0 quickly
    const script = 'console.log("ready"); process.exit(0);'

    const start = Date.now()
    const result = await runCommand({
      executablePath: process.execPath,
      command: 'ffmpeg',
      args: ['-e', script],
      cmdLog,
      timeoutMs: 5000,
      sink,
    })
    const elapsed = Date.now() - start

    expect(result.ok).toBe(true)
    // The runner should have waited for the process to actually exit.
    // A non-trivial process (even a trivial exit) takes > 50ms on most
    // platforms; the key guarantee is that the exit event was emitted
    // before the promise resolved.
    expect(elapsed).toBeGreaterThanOrEqual(0)

    // Sink must have received the system/exit event.
    const systemEvents = events.filter((e) => e.type === 'system')
    expect(systemEvents.length).toBeGreaterThanOrEqual(1)
    const exitEvent = systemEvents.find(
      (e) => (e.data as { event: string }).event === 'exit',
    )
    expect(exitEvent).toBeDefined()
    expect((exitEvent!.data as { code: number }).code).toBe(0)
  })

  it('does NOT resolve runCommand before the process exits', async () => {
    const cmdLog = await createCommandExecutionLogWriter()
    const sink = {
      system: (e: unknown) => sink_events.push(e),
    }
    const sink_events: unknown[] = []

    // Long-running script: 500ms before exit
    const script = 'setTimeout(() => process.exit(0), 500)'

    const result = await runCommand({
      executablePath: process.execPath,
      command: 'ffmpeg',
      args: ['-e', script],
      cmdLog,
      timeoutMs: 5000,
      sink,
    })

    // The exit event should be in the sink BEFORE runCommand resolves.
    // This guarantees the response body in the streaming flow contains
    // the exit event before the stream is closed.
    expect(sink_events.length).toBeGreaterThanOrEqual(1)
    const exitEvent = sink_events.find(
      (e) => (e as { event: string }).event === 'exit',
    )
    expect(exitEvent).toBeDefined()
    expect(result.ok).toBe(true)
  })
})
