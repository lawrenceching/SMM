import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DownloadVideoDialog } from './download-video-dialog'

const h = vi.hoisted(() => ({
  saveDownloadVideoJob: vi.fn().mockResolvedValue(undefined),
  mutateEpisodesMetadata: vi.fn(),
  resetEpisodesMetadata: vi.fn(),
  mutateCollectionMetadata: vi.fn(),
  resetCollectionMetadata: vi.fn(),
  extractReset: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  validateDownloadUrl: vi.fn(),
}))

vi.mock('@/lib/downloadTaskDb', () => ({
  saveDownloadVideoJob: h.saveDownloadVideoJob,
}))

vi.mock('@/hooks/ytdlp/useYtdlpMutations', () => ({
  useBilibiliEpisodesMetadataMutation: () => ({
    mutate: h.mutateEpisodesMetadata,
    reset: h.resetEpisodesMetadata,
  }),
  useBilibiliCollectionMetadataMutation: () => ({
    mutate: h.mutateCollectionMetadata,
    reset: h.resetCollectionMetadata,
    isPending: false,
  }),
  useExtractYtdlpVideoDataMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ title: 'Mock Title', artist: 'Mock Artist' }),
    reset: h.extractReset,
    isPending: false,
  }),
}))

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

// Mock translation hook
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string; count?: number }) => {
      if (options?.ns === 'common') {
        const commonTranslations: Record<string, string> = {
          cancel: 'Cancel',
        }
        return commonTranslations[key] || key
      }
      const dialogsTranslations: Record<string, string> = {
        'downloadVideo.title': 'Download Video',
        'downloadVideo.description': 'Enter the video URL and select the download folder',
        'downloadVideo.urlLabel': 'Video URL',
        'downloadVideo.folderLabel': 'Download Folder',
        'downloadVideo.folderPlaceholder': 'Select download folder...',
        'downloadVideo.start': 'Start',
        'downloadVideo.downloading': 'Downloading...',
        'downloadVideo.agreementTitle': 'Legal and licensing notice',
        'downloadVideo.agreementDescription':
          'You may only download content that you have the legal right and proper license to download.',
        'downloadVideo.agreementCheckboxLabel':
          'I understand and agree that I will not use this feature to download illegal or unlicensed content.',
        'downloadVideo.agreementRequiredNotice': 'You must agree before downloading.',
        'downloadVideo.backgroundQueued': 'Added to background.',
        'downloadVideo.backgroundJobEpisodesName': `Episodes (${options?.count ?? 0} videos)`,
        'downloadVideo.downloadEpisodesLabel': 'Download episodes',
        'downloadVideo.getVideos': 'Get videos',
        'downloadVideo.collectionVideosLoading': 'Loading video list…',
        'downloadVideo.episodesLoading': 'Loading episodes…',
        'downloadVideo.episodesNoneSelected': 'Select at least one item.',
      }
      return dialogsTranslations[key] || key
    },
  }),
}))

// Mock validateDownloadUrl to avoid depending on implementation details
vi.mock('@core/download-video-validators', () => ({
  validateDownloadUrl: h.validateDownloadUrl,
}))

vi.mock('sonner', () => ({
  toast: {
    error: h.toastError,
    success: h.toastSuccess,
  },
}))

describe('DownloadVideoDialog - user agreement', () => {
  const mockOnClose = vi.fn()
  const mockOnOpenFilePicker = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onOpenFilePicker: mockOnOpenFilePicker,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    h.mutateEpisodesMetadata.mockReset()
    h.resetEpisodesMetadata.mockReset()
    h.mutateCollectionMetadata.mockReset()
    h.resetCollectionMetadata.mockReset()
    h.extractReset.mockReset()
    h.toastError.mockReset()
    h.toastSuccess.mockReset()
    h.validateDownloadUrl.mockReset()
    h.validateDownloadUrl.mockImplementation((value: string) => ({
      valid: value.trim().length > 0 && !value.includes('invalid'),
      error: 'URL_EMPTY',
    }))
    // Reset localStorage between tests
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('shows agreement block and disables inputs on first open when user has not agreed', () => {
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // Agreement title and description should be visible
    expect(screen.getByText('Legal and licensing notice')).toBeInTheDocument()

    // URL and folder inputs should be disabled before agreement
    const urlInput = screen.getByLabelText('Video URL') as HTMLInputElement
    const folderInput = screen.getByLabelText('Download Folder') as HTMLInputElement
    const startButton = screen.getByText('Start') as HTMLButtonElement

    expect(urlInput.disabled).toBe(true)
    expect(folderInput.disabled).toBe(true)
    expect(startButton.disabled).toBe(true)
  })

  it('enables inputs and start button after user checks agreement, and persists to localStorage', () => {
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    const checkbox = screen.getByLabelText(
      'I understand and agree that I will not use this feature to download illegal or unlicensed content.'
    ) as HTMLInputElement

    fireEvent.click(checkbox)

    const urlInput = screen.getByLabelText('Video URL') as HTMLInputElement
    const folderInput = screen.getByLabelText('Download Folder') as HTMLInputElement

    expect(checkbox.checked).toBe(true)
    expect(urlInput.disabled).toBe(false)
    expect(folderInput.disabled).toBe(false)
    expect(window.localStorage.getItem('DownloadVideoDialog.userAgreed')).toBe('true')
  })

  it('skips agreement block and keeps controls enabled when user has previously agreed', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // Agreement title should not be shown
    expect(screen.queryByText('Legal and licensing notice')).not.toBeInTheDocument()

    const urlInput = screen.getByLabelText('Video URL') as HTMLInputElement
    const folderInput = screen.getByLabelText('Download Folder') as HTMLInputElement

    expect(urlInput.disabled).toBe(false)
    expect(folderInput.disabled).toBe(false)
  })

  it('shows Get videos checkbox but not Start until the collection list is loaded', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: {
        value: 'https://space.bilibili.com/131560419/lists/7780118',
      },
    })

    expect(screen.queryByTestId('download-video-dialog-start')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('download-video-dialog-get-videos-checkbox')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('download-video-dialog-episodes-checkbox')
    ).not.toBeInTheDocument()
  })

  it('shows Start after checking Get videos and enqueues one job per selected collection video URL', async () => {
    const videoUrl = 'https://www.bilibili.com/video/BV1test'
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateCollectionMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        entries: [
          {
            ie_key: 'BiliBili',
            id: 'BV1test',
            _type: 'url',
            url: videoUrl,
          },
        ],
      })
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: {
        value: 'https://space.bilibili.com/131560419/lists/7780118',
      },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-get-videos-checkbox'))

    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-start')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'D:\\collection-downloads' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-start'))

    await waitFor(() => {
      expect(h.saveDownloadVideoJob).toHaveBeenCalledTimes(1)
      expect(h.saveDownloadVideoJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'download-video',
          data: expect.objectContaining({
            folder: 'D:\\collection-downloads',
            videos: [
              expect.objectContaining({
                url: videoUrl,
              }),
            ],
          }),
        })
      )
    })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('does not create a background job if user has not agreed, even when URL and folder look valid', () => {
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    const urlInput = screen.getByLabelText('Video URL') as HTMLInputElement
    const startButton = screen.getByText('Start') as HTMLButtonElement

    // Try typing via fireEvent even though the field is disabled;
    // component should still guard in handleStart using hasAgreed.
    fireEvent.change(urlInput, { target: { value: 'https://example.com/video' } })
    fireEvent.click(startButton)

    expect(h.saveDownloadVideoJob).not.toHaveBeenCalled()
  })

  it('creates a download-video job and starts orchestration when the form is valid', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: '   https://example.com/video   ' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))

    await waitFor(() => {
      expect(h.saveDownloadVideoJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'download-video',
          data: expect.objectContaining({
            folder: 'C:\\downloads',
            videos: expect.arrayContaining([
              expect.objectContaining({ url: 'https://example.com/video' }),
            ]),
          }),
        })
      )
    })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('does not show Download episodes checkbox for YouTube URL', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.youtube.com/watch?v=test123' },
    })

    expect(screen.queryByLabelText('Download episodes')).not.toBeInTheDocument()
  })

  it('shows Download episodes checkbox for bilibili URL', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1xx411c7mD/' },
    })

    expect(screen.getByLabelText('Download episodes')).toBeInTheDocument()
  })

  it('unchecks Download episodes and clears episode list when bilibili URL changes', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateEpisodesMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        error: null,
        videos: [
          {
            id: 'BV1xx411c7mD',
            title: 'Episode 1',
            fulltitle: 'Episode 1',
            webpage_url: 'https://www.bilibili.com/video/BV1xx411c7mD/',
            uploader: 'Uploader',
          },
        ],
      })
      handlers?.onSettled?.()
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1xx411c7mD/' },
    })

    const downloadEpisodesCheckbox = screen.getByLabelText('Download episodes') as HTMLInputElement
    fireEvent.click(downloadEpisodesCheckbox)

    await waitFor(() => {
      expect(screen.getByText('Episode 1')).toBeInTheDocument()
    })
    expect(downloadEpisodesCheckbox.checked).toBe(true)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV9xx411c7mD/' },
    })

    await waitFor(() => {
      expect((screen.getByLabelText('Download episodes') as HTMLInputElement).checked).toBe(false)
      expect(screen.queryByText('Episode 1')).not.toBeInTheDocument()
    })
  })

  it('shows validation error on URL blur when URL is invalid', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    const urlInput = screen.getByLabelText('Video URL')
    fireEvent.change(urlInput, { target: { value: 'invalid-url' } })
    fireEvent.blur(urlInput)

    await waitFor(() => {
      expect(screen.getByText('downloadVideo.validation.URL_EMPTY')).toBeInTheDocument()
    })
  })

  it('does not enqueue when URL is invalid on start', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'invalid-url' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))

    expect(h.saveDownloadVideoJob).not.toHaveBeenCalled()
  })

  it('does not enqueue when folder is empty', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.click(screen.getByText('Start'))

    expect(h.saveDownloadVideoJob).not.toHaveBeenCalled()
  })

  it('shows episodes fetch error and clears list', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateEpisodesMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({ error: 'Fetch failed', videos: [] })
      handlers?.onSettled?.()
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1aa411c7mD/' },
    })
    fireEvent.click(screen.getByLabelText('Download episodes'))

    await waitFor(() => {
      expect(screen.getByText('Fetch failed')).toBeInTheDocument()
    })
    expect(screen.queryByText('Episode 1')).not.toBeInTheDocument()
  })

  it('ignores stale episodes metadata response after URL changes', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    let firstHandlers: { onSuccess?: Function; onSettled?: Function } | undefined
    h.mutateEpisodesMetadata.mockImplementation((_url, handlers) => {
      if (!firstHandlers) {
        firstHandlers = handlers as { onSuccess?: Function; onSettled?: Function }
        return
      }
      handlers?.onSuccess?.({
        error: null,
        videos: [
          {
            id: 'BV-new',
            title: 'New Episode',
            webpage_url: 'https://www.bilibili.com/video/BV-new/',
          },
        ],
      })
      handlers?.onSettled?.()
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV-old/' },
    })
    fireEvent.click(screen.getByLabelText('Download episodes'))

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV-new/' },
    })
    fireEvent.click(screen.getByLabelText('Download episodes'))

    firstHandlers?.onSuccess?.({
      error: null,
      videos: [
        {
          id: 'BV-old',
          title: 'Old Episode',
          webpage_url: 'https://www.bilibili.com/video/BV-old/',
        },
      ],
    })
    firstHandlers?.onSettled?.()

    await waitFor(() => {
      expect(screen.getByText('New Episode')).toBeInTheDocument()
    })
    expect(screen.queryByText('Old Episode')).not.toBeInTheDocument()
  })

  it('does not enqueue when episodes mode enabled but nothing selected', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.mutateEpisodesMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        error: null,
        videos: [
          {
            id: 'BV1',
            title: 'Episode 1',
            webpage_url: 'https://www.bilibili.com/video/BV1/',
          },
        ],
      })
      handlers?.onSettled?.()
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1/' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByLabelText('Download episodes'))
    await waitFor(() => expect(screen.getByText('Episode 1')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('checkbox')[1]) // episode row checkbox
    fireEvent.click(screen.getByText('Start'))

    expect(h.saveDownloadVideoJob).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('creates one job per selected episode with itemMeta in episodes mode', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateEpisodesMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        error: null,
        videos: [
          {
            id: 'BV1',
            title: 'Episode 1',
            uploader: 'Artist A',
            webpage_url: 'https://www.bilibili.com/video/BV1/',
          },
          {
            id: 'BV2',
            title: 'Episode 2',
            uploader: 'Artist B',
            webpage_url: 'https://www.bilibili.com/video/BV2/',
          },
        ],
      })
      handlers?.onSettled?.()
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV-list/' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByLabelText('Download episodes'))
    await waitFor(() => expect(screen.getByText('Episode 1')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Episode 2'))
    fireEvent.click(screen.getByText('Start'))

    await waitFor(() => {
      expect(h.saveDownloadVideoJob).toHaveBeenCalledTimes(1)
    })
    expect(h.saveDownloadVideoJob).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          videos: [
            expect.objectContaining({
              url: 'https://www.bilibili.com/video/BV1/',
              title: 'Episode 1',
              artist: 'Artist A',
            }),
          ],
        }),
      })
    )
  })

  it('shows toast error and keeps dialog open when save fails', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.saveDownloadVideoJob.mockImplementationOnce(() => {
      throw new Error('Persist failed')
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))

    await waitFor(() => {
      expect(h.toastError).toHaveBeenCalledWith('Persist failed')
    })
    expect(mockOnClose).not.toHaveBeenCalled()
    expect((screen.getByText('Start') as HTMLButtonElement).disabled).toBe(false)
  })

  it('cancel resets transient state and calls reset hooks plus onClose', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateEpisodesMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        error: null,
        videos: [{ id: 'BV1', title: 'Episode 1', webpage_url: 'https://www.bilibili.com/video/BV1/' }],
      })
      handlers?.onSettled?.()
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), { target: { value: 'https://www.bilibili.com/video/BV1/' } })
    fireEvent.change(screen.getByLabelText('Download Folder'), { target: { value: 'C:\\downloads' } })
    fireEvent.click(screen.getByLabelText('Download episodes'))
    await waitFor(() => expect(screen.getByText('Episode 1')).toBeInTheDocument())
    fireEvent.click(screen.getByText('cancel'))

    expect(mockOnClose).toHaveBeenCalled()
    expect(h.resetEpisodesMetadata).toHaveBeenCalled()
    expect(h.extractReset).toHaveBeenCalled()
  })

  it('folder picker uses current folder as initialPath and callback updates input', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Download Folder'), { target: { value: 'C:\\downloads' } })
    const folderInput = screen.getByLabelText('Download Folder')
    const browseButton = folderInput.parentElement?.querySelector('button')
    expect(browseButton).toBeTruthy()

    fireEvent.click(browseButton as HTMLButtonElement)

    expect(mockOnOpenFilePicker).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ selectFolder: true, initialPath: 'C:\\downloads' })
    )

    const callback = mockOnOpenFilePicker.mock.calls[0][0] as (file: { path: string }) => void
    act(() => {
      callback({ path: 'D:\\music' })
    })
    expect((screen.getByLabelText('Download Folder') as HTMLInputElement).value).toBe('D:\\music')
  })
})
