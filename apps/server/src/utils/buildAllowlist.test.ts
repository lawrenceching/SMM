import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildAllowlist } from './buildAllowlist'

vi.mock('./config', () => ({
  getUserConfig: vi.fn(),
  getUserDataDir: vi.fn(() => '/user-data'),
  getAppDataDir: vi.fn(() => '/app-data'),
  getTmpDir: vi.fn(() => '/tmp/smm'),
}))

describe('buildAllowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not throw when userConfig.folders is undefined', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      tmdb: {},
      tvdb: {},
      renameRules: [],
      dryRun: false,
      selectedRenameRule: 'plex',
    } as unknown as Awaited<ReturnType<typeof getUserConfig>>)

    const allowlist = await buildAllowlist()

    expect(allowlist).toEqual(
      expect.arrayContaining(['/user-data', '/app-data', '/tmp/smm']),
    )
    expect(allowlist).toHaveLength(3)
  })

  it('includes media folders from userConfig', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      folders: ['/media/show'],
      tmdb: {},
      tvdb: {},
      renameRules: [],
      dryRun: false,
      selectedRenameRule: 'plex',
    } as Awaited<ReturnType<typeof getUserConfig>>)

    const allowlist = await buildAllowlist()

    expect(allowlist).toContain('/media/show')
  })
})
