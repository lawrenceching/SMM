import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { CommandPort, CommandRunResult } from '@smm/core'
import { ytdlpInspectRoute } from './YtdlpInspect'
import { getCore, resetCoreForTests } from '../core/getCore'

describe('POST /api/ytdlp-inspect', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-ytdlp-inspect-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  async function post(body: unknown) {
    return ytdlpInspectRoute.request('/api/ytdlp-inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns Error Reason when url is missing', async () => {
    getCore({
      _ports: {
        command: { run: vi.fn() },
      },
    })
    const res = await post({})
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: url is required/)
  })

  it('returns video metadata from CommandPort stdout', async () => {
    const stdout = JSON.stringify({
      _type: 'video',
      id: 'BV1',
      title: 'Demo',
      formats: [],
    })
    const command: CommandPort = {
      run: vi.fn(async (): Promise<CommandRunResult> => ({
        exitCode: 0,
        stdout,
        stderr: '',
      })),
    }
    getCore({ _ports: { command } })

    const res = await post({ url: 'https://www.bilibili.com/video/BV1' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      data?: { video: { id: string; title: string } }
      error?: string
    }
    expect(json.error).toBeUndefined()
    expect(json.data?.video.id).toBe('BV1')
    expect(json.data?.video.title).toBe('Demo')
    expect(command.run).toHaveBeenCalledOnce()
  })

  it('returns simulated test.local error without CommandPort.run', async () => {
    const command: CommandPort = { run: vi.fn() }
    getCore({ _ports: { command } })

    const res = await post({ url: 'https://test.local/bilibili/http/412' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/http-412/i)
    expect(command.run).not.toHaveBeenCalled()
  })
})
