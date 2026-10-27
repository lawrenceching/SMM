import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { CommandPort, CommandRunResult } from '@smm/core'
import { ytdlpListSubsRoute } from './YtdlpListSubs'
import { getCore, resetCoreForTests } from '../core/getCore'

const LIST_SUBS_STDOUT = `
[info] Available subtitles for BV1:
Language  Name     Formats
en        English  vtt
`.trim()

describe('POST /api/ytdlp-list-subs', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-ytdlp-list-subs-'))
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
    return ytdlpListSubsRoute.request('/api/ytdlp-list-subs', {
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

  it('returns languages from --list-subs stdout', async () => {
    const command: CommandPort = {
      run: vi.fn(async (): Promise<CommandRunResult> => ({
        exitCode: 0,
        stdout: LIST_SUBS_STDOUT,
        stderr: '',
      })),
    }
    getCore({ _ports: { command } })

    const res = await post({ url: 'https://www.bilibili.com/video/BV1' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      data?: { languages: Array<{ code: string; kind: string }> }
      error?: string
    }
    expect(json.error).toBeUndefined()
    expect(json.data?.languages).toEqual([{ code: 'en', name: 'English', kind: 'manual' }])
    const args = (command.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0].args as string[]
    expect(args).toContain('--list-subs')
  })
})
