import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AI_AGENT_PERMISSIONS, type UserConfig } from '@smm/types'
import { defaultUserConfig, normalizeUserConfig, readUserConfigFromUserDataDir } from './readUserConfig'
import { fetchUserConfig } from './userConfigHttp'

vi.mock('./userConfigHttp', () => ({
  fetchUserConfig: vi.fn(),
}))

const mockFetchUserConfig = vi.mocked(fetchUserConfig)

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

  it('fills missing aiAgent with empty permissions', () => {
    const raw: Partial<UserConfig> = { folders: [] }

    const normalized = normalizeUserConfig(raw)

    expect(normalized.aiAgent).toEqual({ permissions: [] })
  })

  it('merges partial aiAgent without dropping other defaults', () => {
    const raw: Partial<UserConfig> = {
      aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
    }

    const normalized = normalizeUserConfig(raw)

    expect(normalized.aiAgent).toEqual({ permissions: ['metadata.write'] })
  })

  it('keeps aiAgent through a serialize → normalize round trip', () => {
    const normalized = normalizeUserConfig({
      aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
    })
    const persisted = JSON.parse(JSON.stringify(normalized))
    expect(normalizeUserConfig(persisted).aiAgent).toEqual({
      permissions: ['metadata.write'],
    })
  })
})

describe('readUserConfigFromUserDataDir', () => {
  it('returns defaultUserConfig when the server returns an empty document', async () => {
    mockFetchUserConfig.mockResolvedValue({} as UserConfig)

    const config = await readUserConfigFromUserDataDir('/tmp/smm-data')

    expect(config).toEqual(defaultUserConfig)
  })

  it('normalizes persisted config missing tvdb', async () => {
    mockFetchUserConfig.mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      tvdb: {},
      folders: [],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: 'plex',
      preferMediaLanguage: 'zh-CN',
    })

    const config = await readUserConfigFromUserDataDir('/tmp/smm-data')

    expect(config.tvdb).toEqual(defaultUserConfig.tvdb)
    expect(config.tmdb).toEqual(defaultUserConfig.tmdb)
    expect(config.preferMediaLanguage).toBe('zh-CN')
  })
})
