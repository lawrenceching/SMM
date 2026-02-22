import { describe, it, expect, vi, beforeEach } from 'vitest'
import { allowRead } from './permission'

vi.mock('./config', () => ({
  getUserConfig: vi.fn(),
}))

describe('allowRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return false when folders is undefined', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: undefined,
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/album')
    expect(result).toBe(false)
  })

  it('should return true when path matches a folder exactly', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music/album'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/album')
    expect(result).toBe(true)
  })

  it('should return true when path is a file under an allowed folder', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music/album'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/album/song.mp3')
    expect(result).toBe(true)
  })

  it('should return true when path is a subdirectory under an allowed folder', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music/album'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/album/subdir/file.mp3')
    expect(result).toBe(true)
  })

  it('should return false when path is not under any allowed folder', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music/album'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/video/movie.mkv')
    expect(result).toBe(false)
  })

  it('should return false when path is a sibling folder', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music/album'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/other-album')
    expect(result).toBe(false)
  })

  it('should handle multiple allowed folders', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music', '/media/videos'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result1 = await allowRead('/media/music/song.mp3')
    const result2 = await allowRead('/media/videos/movie.mp4')
    const result3 = await allowRead('/media/photos/img.jpg')

    expect(result1).toBe(true)
    expect(result2).toBe(true)
    expect(result3).toBe(false)
  })

  it('should throw error for non-POSIX path', async () => {
    await expect(allowRead('C:\\Users\\music\\song.mp3')).rejects.toThrow('only POSIX format path is supported')
  })

  it('should return false when folders array is empty', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: [],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/song.mp3')
    expect(result).toBe(false)
  })

  it('should return true for deeply nested path under allowed folder', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/artist/album/song.mp3')
    expect(result).toBe(true)
  })

  it('should handle multiple folders - match first folder', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music', '/media/videos', '/media/photos'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/song.mp3')
    expect(result).toBe(true)
  })

  it('should handle multiple folders - match middle folder', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music', '/media/videos', '/media/photos'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/videos/movie.mp4')
    expect(result).toBe(true)
  })

  it('should handle multiple folders - match last folder', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music', '/media/videos', '/media/photos'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/photos/img.jpg')
    expect(result).toBe(true)
  })

  it('should handle path with trailing slash', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music/album'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/album/')
    expect(result).toBe(true)
  })

  it('should return false for partial folder name match', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music2/song.mp3')
    expect(result).toBe(false)
  })

  it('should return false for root path', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/')
    expect(result).toBe(false)
  })

  it('should throw error for empty string path', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    await expect(allowRead('')).rejects.toThrow('only POSIX format path is supported')
  })

  it('should handle overlapping folder paths correctly', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media', '/media/music'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result1 = await allowRead('/media/video.mp4')
    const result2 = await allowRead('/media/music/song.mp3')

    expect(result1).toBe(true)
    expect(result2).toBe(true)
  })

  it('should handle overlapping folder paths - should not allow parent if only child is configured', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/music/album'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result1 = await allowRead('/media/music/album/song.mp3')
    const result2 = await allowRead('/media/music')

    expect(result1).toBe(true)
    expect(result2).toBe(false)
  })

  it('should be case sensitive when matching paths', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/Music'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/music/song.mp3')
    expect(result).toBe(false)
  })

  it('should handle paths with special characters', async () => {
    const { getUserConfig } = await import('./config')
    vi.mocked(getUserConfig).mockResolvedValue({
      applicationLanguage: 'en',
      tmdb: {},
      folders: ['/media/音乐专辑'],
      renameRules: [],
      dryRun: false,
      selectedRenameRule: '',
    } as any)

    const result = await allowRead('/media/音乐专辑/歌曲.mp3')
    expect(result).toBe(true)
  })
})
