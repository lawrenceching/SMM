import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Path } from '@core/path'
import type { RenameFilesRequestBody, RenameFilesResponseBody } from '@core/types'
import { applyRenameFilesPlanForTvShow } from './applyRenameFilesPlanForTvShow'
import type { UIRenameFilesPlan } from '@/types/UIRenameFilesPlan'

type RenameFilesApi = (params: RenameFilesRequestBody) => Promise<RenameFilesResponseBody>

describe.skipIf(Path.isWindows())('applyRenameFilesPlanForTvShow', () => {

  let mockRenameFilesApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockRenameFilesApi = vi.fn().mockResolvedValue({})
  })

  it('Can rename video file and all supported associated files', async () => {

    const mediaFolderPath = '/media/show'
    const plan: UIRenameFilesPlan = {
      id: 'plan-1',
      task: 'rename-files',
      status: 'pending',
      mediaFolderPath,
      tmp: false,
      files: [
        { from: '/media/show/1.mkv', to: '/media/show/S01E01.mkv' },
      ],
    }
    const localFiles = [
      '/media/show/1.mkv',
      '/media/show/1.jpg',
      '/media/show/1.srt',
      '/media/show/1.mka',
      '/media/show/1.nfo',
      '/media/show/fanart.jpg',
    ]

    await applyRenameFilesPlanForTvShow(
      { mediaFolderPath, localFiles, plan },
      { renameFilesApi: mockRenameFilesApi as RenameFilesApi }
    )

    expect(mockRenameFilesApi).toHaveBeenCalledTimes(1)
    const [req] = mockRenameFilesApi.mock.calls[0]
    expect(req.mediaFolder).toBe(mediaFolderPath)
    expect(req.files).toHaveLength(5)
    expect(req.files[0].from).toBe(Path.toPlatformPath('/media/show/1.mkv'))
    expect(req.files[0].to).toBe(Path.toPlatformPath('/media/show/S01E01.mkv'))
    expect(req.files).toContainEqual({ from: Path.toPlatformPath('/media/show/1.jpg'), to: Path.toPlatformPath('/media/show/S01E01.jpg') })
    expect(req.files).toContainEqual({ from: Path.toPlatformPath('/media/show/1.srt'), to: Path.toPlatformPath('/media/show/S01E01.srt') })
    expect(req.files).toContainEqual({ from: Path.toPlatformPath('/media/show/1.mka'), to: Path.toPlatformPath('/media/show/S01E01.mka') })
    expect(req.files).toContainEqual({ from: Path.toPlatformPath('/media/show/1.nfo'), to: Path.toPlatformPath('/media/show/S01E01.nfo') })
    expect(req.files.some((f: { from: string }) => f.from === Path.toPlatformPath('/media/show/fanart.jpg'))).toBe(false)
  })

  it('Can rename video file and subtitle files with language code', async () => {

    const mediaFolderPath = '/media/show'
    const plan: UIRenameFilesPlan = {
      id: 'plan-1',
      task: 'rename-files',
      status: 'pending',
      mediaFolderPath,
      tmp: false,
      files: [
        { from: '/media/show/1.mkv', to: '/media/show/S01E01.mkv' },
      ],
    }
    const localFiles = [
      '/media/show/1.mkv',
      '/media/show/1.sc.srt',
      '/media/show/1.tc.srt',
    ]

    await applyRenameFilesPlanForTvShow(
      { mediaFolderPath, localFiles, plan },
      { renameFilesApi: mockRenameFilesApi as RenameFilesApi }
    )

    expect(mockRenameFilesApi).toHaveBeenCalledTimes(1)
    const [req] = mockRenameFilesApi.mock.calls[0]
    expect(req.mediaFolder).toBe(mediaFolderPath)
    expect(req.files).toHaveLength(3)
    expect(req.files[0].from).toContain('1.mkv')
    expect(req.files[0].to).toContain('S01E01.mkv')
    expect(req.files).toContainEqual(expect.objectContaining({ from: expect.stringContaining('1.sc.srt'), to: expect.stringContaining('S01E01.sc.srt') }))
    expect(req.files).toContainEqual(expect.objectContaining({ from: expect.stringContaining('1.tc.srt'), to: expect.stringContaining('S01E01.tc.srt') }))
  })

  it('Can rename video file and subtitle files to new path in season folder', async () => {
    const mediaFolderPath = '/media/show'
    const plan: UIRenameFilesPlan = {
      id: 'plan-1',
      task: 'rename-files',
      status: 'pending',
      mediaFolderPath,
      tmp: false,
      files: [
        { from: '/media/show/1.mkv', to: '/media/show/Season 01/S01E01.mkv' },
      ],
    }
    const localFiles = [
      '/media/show/1.mkv',
      '/media/show/1.jpg',
      '/media/show/1.srt',
      '/media/show/1.mka',
      '/media/show/1.nfo',
      '/media/show/fanart.jpg',
    ]

    await applyRenameFilesPlanForTvShow(
      { mediaFolderPath, localFiles, plan },
      { renameFilesApi: mockRenameFilesApi as RenameFilesApi }
    )

    expect(mockRenameFilesApi).toHaveBeenCalledTimes(1)
    const [req] = mockRenameFilesApi.mock.calls[0]
    expect(req.mediaFolder).toBe(mediaFolderPath)
    expect(req.files).toHaveLength(5)
    expect(req.files[0].from).toBe(Path.toPlatformPath('/media/show/1.mkv'))
    expect(req.files[0].to).toBe(Path.toPlatformPath('/media/show/S01E01.mkv'))
    expect(req.files).toContainEqual({ from: Path.toPlatformPath('/media/show/1.jpg'), to: Path.toPlatformPath('/media/show/Season 01/S01E01.jpg') })
    expect(req.files).toContainEqual({ from: Path.toPlatformPath('/media/show/1.srt'), to: Path.toPlatformPath('/media/show/Season 01/S01E01.srt') })
    expect(req.files).toContainEqual({ from: Path.toPlatformPath('/media/show/1.mka'), to: Path.toPlatformPath('/media/show/Season 01/S01E01.mka') })
    expect(req.files).toContainEqual({ from: Path.toPlatformPath('/media/show/1.nfo'), to: Path.toPlatformPath('/media/show/Season 01/S01E01.nfo') })
  }) 

})
