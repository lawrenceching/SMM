import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { UserConfig } from '@smm/types'
import { defaultUserConfig, normalizeUserConfig, readUserConfigFromUserDataDir } from './readUserConfig'
import { readFile } from './readFile'

vi.mock('./readFile', () => ({
  readFile: vi.fn(),
}))

const mockReadFile = vi.mocked(readFile)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeUserConfig', () => {
  it('fills missing tvdb and tmdb with defaults', () => {
    const raw = {
      applicationLanguage: 'en' as const,
      folders: ['/tmp/show'],
      preferMediaLanguage: 'zh-CN' as const,
    }

    const normalized = normalizeUserConfig(raw)

    expect(normalized.tvdb).toEqual(defaultUserConfig.tvdb)
    expect(normalized.tmdb).toEqual(defaultUserConfig.tmdb)
    expect(normalized.folders).toEqual(['/tmp/show'])
    expect(normalized.preferMediaLanguage).toBe('zh-CN')
  })

  it('merges partial tmdb and tvdb without dropping other defaults', () => {
    const raw: Partial<UserConfig> = {
      tmdb: { apiKey: 'tmdb-key' },
      tvdb: { host: 'https://custom.tvdb.example' },
    }

    const normalized = normalizeUserConfig(raw)

    expect(normalized.tmdb).toEqual({
      host: '',
      apiKey: 'tmdb-key',
      httpProxy: '',
    })
    expect(normalized.tvdb).toEqual({
      host: 'https://custom.tvdb.example',
      apiKey: '',
    })
    expect(normalized.primaryDatabase).toBe('TMDB')
  })
})

describe('readUserConfigFromUserDataDir', () => {
  it('returns defaultUserConfig when smm.json is missing', async () => {
    mockReadFile.mockResolvedValue({ data: undefined, error: undefined })

    const config = await readUserConfigFromUserDataDir('/tmp/smm-data')

    expect(config).toEqual(defaultUserConfig)
  })

  it('normalizes persisted config missing tvdb', async () => {
    mockReadFile.mockResolvedValue({
      data: JSON.stringify({
        applicationLanguage: 'en',
        tmdb: {},
        folders: [],
        preferMediaLanguage: 'zh-CN',
      }),
      error: undefined,
    })

    const config = await readUserConfigFromUserDataDir('/tmp/smm-data')

    expect(config.tvdb).toEqual(defaultUserConfig.tvdb)
    expect(config.tmdb).toEqual(defaultUserConfig.tmdb)
    expect(config.preferMediaLanguage).toBe('zh-CN')
  })
})
