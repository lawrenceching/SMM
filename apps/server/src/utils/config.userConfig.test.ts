import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('getUserConfig merges defaults for incomplete smm.json', () => {
  let previousUserDataDir: string | undefined
  let userDataDir: string

  beforeEach(() => {
    previousUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-get-user-config-'))
    process.env.USER_DATA_DIR = userDataDir
  })

  afterEach(() => {
    if (previousUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = previousUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('fills folders when persisted config omits the field', async () => {
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({ ytdlpProxy: 'http://127.0.0.1:7890' }),
      'utf-8',
    )

    const exists = vi.fn().mockResolvedValue(true)
    const text = vi.fn().mockResolvedValue(
      JSON.stringify({ ytdlpProxy: 'http://127.0.0.1:7890' }),
    )
    vi.stubGlobal('Bun', {
      file: vi.fn(() => ({ exists, text })),
    })

    const { getUserConfig } = await import('./config')
    const config = await getUserConfig()

    expect(config.folders).toEqual([])
    expect(config.ytdlpProxy).toBe('http://127.0.0.1:7890')
    expect(config.tmdb).toEqual(expect.any(Object))
    expect(config.tvdb).toEqual(expect.any(Object))
  })

  it('preserves persisted folders when present', async () => {
    const exists = vi.fn().mockResolvedValue(true)
    const text = vi.fn().mockResolvedValue(
      JSON.stringify({ folders: ['/media/a'], tmdb: { apiKey: 'k' }, tvdb: {} }),
    )
    vi.stubGlobal('Bun', {
      file: vi.fn(() => ({ exists, text })),
    })

    const { getUserConfig } = await import('./config')
    const config = await getUserConfig()

    expect(config.folders).toEqual(['/media/a'])
    expect(config.tmdb.apiKey).toBe('k')
  })
})
