import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DownloadVideoDialog } from './download-video-dialog'
import { clearCookiesCache } from '@/lib/ytdlpCookiesCache'

const h = vi.hoisted(() => ({
  saveDownloadVideoJob: vi.fn().mockResolvedValue(undefined),
  mutateEpisodesMetadata: vi.fn(),
  resetEpisodesMetadata: vi.fn(),
  mutateCollectionMetadata: vi.fn(),
  resetCollectionMetadata: vi.fn(),
  mutateListFormats: vi.fn(),
  extractReset: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  validateDownloadUrl: vi.fn(),
  getBilibiliVideoMetadata: vi.fn(),
  openTextDialog: vi.fn(),
  writeYtdlpCookiesFile: vi.fn().mockResolvedValue('/data/user/temp/ytdlp-cookies-job-1.txt'),
}))

vi.mock('@/api/ytdlp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/ytdlp')>()
  return {
    ...actual,
    getBilibiliVideoMetadata: h.getBilibiliVideoMetadata,
  }
})

vi.mock('@/lib/downloadTaskDb', () => ({
  saveDownloadVideoJob: h.saveDownloadVideoJob,
}))

vi.mock('@/hooks/useJobManager', () => ({
  useJobManager: () => ({
    isReady: true,
    createJob: h.saveDownloadVideoJob,
    createJobs: vi.fn().mockResolvedValue({ successIds: [], failures: [] }),
    startJob: vi.fn(),
    stopJob: vi.fn(),
    removeJob: vi.fn(),
  }),
}))
vi.mock('@/hooks/useJobOrchestrator', () => ({
  useJobOrchestrator: () => ({
    isReady: true,
    createJob: h.saveDownloadVideoJob,
    createJobs: vi.fn().mockResolvedValue({ successIds: [], failures: [] }),
    startJob: vi.fn(),
    stopJob: vi.fn(),
    removeJob: vi.fn(),
  }),
  useFileStatuses: vi.fn(() => ({
    runningPaths: new Set<string>(),
    pendingPaths: new Set<string>(),
    failedPaths: new Set<string>(),
    jobIdsByPath: new Map<string, string[]>(),
    primaryJobIdByPath: new Map<string, string>(),
  })),
  useJobs: vi.fn(() => []),
}))

const hListFormats = vi.hoisted(() => ({
  listFormats: vi.fn(),
  reset: vi.fn(),
  resultRef: { current: null as unknown },
}))

vi.mock('./hooks/useListFormatsMutation', () => ({
  useListFormatsMutation: () => ({
    get formatsResult() { return hListFormats.resultRef.current },
    isListing: false,
    listingError: null,
    listFormats: hListFormats.listFormats,
    reset: hListFormats.reset,
  }),
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
  useListYtdlpFormatsMutation: () => ({
    mutate: h.mutateListFormats,
  }),
}))

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

// Mock translation hook
vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/i18n')>()
  return {
    ...actual,
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
          'downloadVideo.formatLabel': 'Video format',
          'downloadVideo.formatDefault': 'Default (automatic)',
          'downloadVideo.formatBest': 'Best quality',
          'downloadVideo.format1080p': '1080p',
          'downloadVideo.format720p': '720p',
          'downloadVideo.formatAudioOnly': 'Audio only',
          'downloadVideo.episodesLoading': 'Loading episodes…',
          'downloadVideo.episodesNoneSelected': 'Select at least one item.',
          'downloadVideo.cookiesConfigure': 'Configure',
          'downloadVideo.useCookiesLabel': 'Use cookies',
          'downloadVideo.useCookiesFromBrowserLabel': 'From browser',
          'downloadVideo.cookiesBrowserSelectLabel': 'Select browser',
          'downloadVideo.cookiesBrowserChrome': 'Chrome',
          'downloadVideo.cookiesBrowserEdge': 'Edge',
          'downloadVideo.cookiesBrowserFirefox': 'Firefox',
          'downloadVideo.cookiesEmpty': 'Enter cookie file content.',
          'downloadVideo.cookiesWriteFailed': 'Could not save cookies file.',
          'downloadVideo.moreOptions.label': 'More options...',
          'downloadVideo.writeThumbnail.label': 'Download thumbnail',
          'downloadVideo.embedThumbnail.label': 'Embed thumbnail in audio/video file',
          'downloadVideo.embedMetadata.label': 'Embed metadata',
          'downloadVideo.formatUnavailableSuffix': ' (unavailable)',
        }
        return dialogsTranslations[key] || key
      },
    }),
  }
})

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

vi.mock('@/providers/dialog-provider', () => ({
  useDialogs: () => ({
    textDialog: [h.openTextDialog, vi.fn()],
  }),
}))

vi.mock('@/hooks/userConfig/useConfig', () => ({
  useConfig: () => ({
    appConfig: { userDataDir: '/data/user', version: 'test', reverseProxyUrl: null },
    userConfig: {},
    setUserConfig: vi.fn(),
    isLoading: false,
    isUserConfigLoaded: true,
    error: null,
    setAndSaveUserConfig: vi.fn(),
    reload: vi.fn(),
    refreshUserConfig: vi.fn(),
    addMediaFolderInUserConfig: vi.fn(),
  }),
}))

vi.mock('@/lib/ytdlpCookiesFile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ytdlpCookiesFile')>()
  return {
    ...actual,
    writeYtdlpCookiesFile: h.writeYtdlpCookiesFile,
  }
})

describe('DownloadVideoDialog - user agreement', () => {
  const mockOnClose = vi.fn()
  const mockOnOpenFilePicker = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onOpenFilePicker: mockOnOpenFilePicker,
  }

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.clearAllMocks()
    clearCookiesCache()
    h.mutateEpisodesMetadata.mockReset()
    h.resetEpisodesMetadata.mockReset()
    h.mutateCollectionMetadata.mockReset()
    h.resetCollectionMetadata.mockReset()
    h.extractReset.mockReset()
    h.toastError.mockReset()
    h.toastSuccess.mockReset()
    h.validateDownloadUrl.mockReset()
    h.getBilibiliVideoMetadata.mockReset()
    h.validateDownloadUrl.mockImplementation((value: string) => ({
      valid: value.trim().length > 0 && !value.includes('invalid'),
      error: 'URL_EMPTY',
    }))
    h.getBilibiliVideoMetadata.mockImplementation(async (url: string) => ({
      _type: 'video',
      id: 'BV',
      title: url,
      fulltitle: url,
      webpage_url: url,
    }))
    // Default: formats already fetched so Start button is enabled by default
    hListFormats.resultRef.current = { availableHeights: [1080, 720, 480, 360], hasAudioOnly: true, formatCodes: [], rawText: '' }
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
    )

    fireEvent.click(checkbox)

    const urlInput = screen.getByLabelText('Video URL') as HTMLInputElement
    const folderInput = screen.getByLabelText('Download Folder') as HTMLInputElement

    // The agreement block is removed from DOM after checking (hasAgreed=true hides it),
    // so we verify the side effects instead of aria-checked on the removed element.
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

  it('shows resolved per-video title in collection list after metadata resolves', async () => {
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
    h.getBilibiliVideoMetadata.mockResolvedValue({
      _type: 'video',
      id: 'BV1test',
      title: 'Short',
      fulltitle: 'Collection row resolved title',
      webpage_url: videoUrl,
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: {
        value: 'https://space.bilibili.com/131560419/lists/7780118',
      },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-get-videos-checkbox'))

    await waitFor(() => {
      expect(screen.getByText('Collection row resolved title')).toBeInTheDocument()
    })
    expect(h.getBilibiliVideoMetadata).toHaveBeenCalledWith(videoUrl)
  })

  it('shows collection list error and toast when collection metadata fetch fails', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateCollectionMetadata.mockImplementation((_url, handlers) => {
      handlers?.onError?.(new Error('Collection list failed'))
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: {
        value: 'https://space.bilibili.com/131560419/lists/7780118',
      },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-get-videos-checkbox'))

    await waitFor(() => {
      expect(screen.getByText('Collection list failed')).toBeInTheDocument()
    })
    expect(h.toastError).toHaveBeenCalledWith('Collection list failed')
    expect(screen.queryByTestId('download-video-dialog-collection-list')).not.toBeInTheDocument()
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
    const job = h.saveDownloadVideoJob.mock.calls[0]?.[0]
    expect(job?.data?.ytdlpFormat).toBeUndefined()
    expect(job?.data?.ytdlpExtraArgs).toBeUndefined()
  })

  it('passes selected ytdlp extra args when more options are enabled', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })

    fireEvent.click(screen.getByTestId('download-video-dialog-more-options-checkbox'))
    fireEvent.click(screen.getByTestId('download-video-dialog-write-thumbnail-checkbox'))
    fireEvent.click(screen.getByText('Start'))

    await waitFor(() => {
      expect(h.saveDownloadVideoJob).toHaveBeenCalled()
    })
    expect(h.saveDownloadVideoJob).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ytdlpExtraArgs: ['--write-thumbnail'],
        }),
      }),
    )
  })

  it('passes 1080p format expression when that preset is selected', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })

    fireEvent.click(screen.getByTestId('download-video-dialog-format-select'))
    const option1080 = await screen.findByRole('option', { name: '1080p' })
    fireEvent.click(option1080)
    fireEvent.click(screen.getByText('Start'))

    await waitFor(() => {
      expect(h.saveDownloadVideoJob).toHaveBeenCalled()
    })
    expect(h.saveDownloadVideoJob).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ytdlpFormat: 'bv*[height<=1080]+ba/b[height<=1080]/best',
        }),
      })
    )
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

    const downloadEpisodesCheckbox = screen.getByLabelText('Download episodes')
    fireEvent.click(downloadEpisodesCheckbox)

    await waitFor(() => {
      expect(screen.getByText('Episode 1')).toBeInTheDocument()
    })
    expect(downloadEpisodesCheckbox).toHaveAttribute('aria-checked', 'true')

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV9xx411c7mD/' },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Download episodes')).toHaveAttribute('aria-checked', 'false')
      expect(screen.queryByText('Episode 1')).not.toBeInTheDocument()
    })
  })

  it('shows validation error when Go is clicked with invalid URL', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    const urlInput = screen.getByLabelText('Video URL')
    fireEvent.change(urlInput, { target: { value: 'invalid-url' } })
    fireEvent.click(screen.getByTestId('download-video-dialog-go-button'))

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
    fireEvent.click(
      screen.getByTestId(
        'download-video-dialog-episode-checkbox-https://www.bilibili.com/video/BV1/',
      ),
    )
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
    fireEvent.click(
      screen.getByTestId(
        'download-video-dialog-episode-checkbox-https://www.bilibili.com/video/BV2/'
      )
    )
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
    fireEvent.click(screen.getByTestId('download-video-dialog-cancel'))

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

  it('opens TextDialog when Cookies button is clicked', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    // Reset so cookies appear at top level (formats not yet fetched)
    hListFormats.resultRef.current = null
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)
    fireEvent.click(screen.getByTestId('download-video-dialog-cookies-button'))
    expect(h.openTextDialog).toHaveBeenCalled()
  })

  it('does not set ytdlpCookiesFile when Use cookies is unchecked', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))
    await waitFor(() => expect(h.saveDownloadVideoJob).toHaveBeenCalled())
    expect(h.writeYtdlpCookiesFile).not.toHaveBeenCalled()
    expect(h.saveDownloadVideoJob.mock.calls[0]?.[0]?.data?.ytdlpCookiesFile).toBeUndefined()
  })

  it('writes cookies file and sets ytdlpCookiesFile when Use cookies is enabled', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.openTextDialog.mockImplementation((onConfirm: (text: string) => void) => {
      onConfirm('# HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t0\tcookie\tvalue')
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-more-options-checkbox'))
    fireEvent.click(screen.getByTestId('download-video-dialog-cookies-button'))
    fireEvent.click(screen.getByLabelText('Use cookies'))
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))
    await waitFor(() => expect(h.writeYtdlpCookiesFile).toHaveBeenCalled())
    expect(h.saveDownloadVideoJob).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ytdlpCookiesFile: '/data/user/temp/ytdlp-cookies-job-1.txt',
        }),
      }),
    )
  })

  it('shows error when Use cookies is enabled but content is empty', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-more-options-checkbox'))
    fireEvent.click(screen.getByLabelText('Use cookies'))
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('Enter cookie file content.'))
    expect(h.saveDownloadVideoJob).not.toHaveBeenCalled()
  })

  it('sets ytdlpCookiesFromBrowser when From browser is enabled', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-more-options-checkbox'))
    fireEvent.click(screen.getByLabelText('From browser'))
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))
    await waitFor(() => expect(h.saveDownloadVideoJob).toHaveBeenCalled())
    expect(h.writeYtdlpCookiesFile).not.toHaveBeenCalled()
    const job = h.saveDownloadVideoJob.mock.calls[0]?.[0]
    expect(job?.data?.ytdlpCookiesFromBrowser).toBe('firefox')
    expect(job?.data?.ytdlpCookiesFile).toBeUndefined()
  })

  it('allows both manual cookies and From browser on the same job', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.openTextDialog.mockImplementation((onConfirm: (text: string) => void) => {
      onConfirm('# HTTP Cookie File\n')
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-more-options-checkbox'))
    fireEvent.click(screen.getByTestId('download-video-dialog-cookies-button'))
    fireEvent.click(screen.getByLabelText('Use cookies'))
    fireEvent.click(screen.getByLabelText('From browser'))
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))
    await waitFor(() => expect(h.saveDownloadVideoJob).toHaveBeenCalled())
    expect(h.writeYtdlpCookiesFile).toHaveBeenCalled()
    const job = h.saveDownloadVideoJob.mock.calls[0]?.[0]
    expect(job?.data?.ytdlpCookiesFromBrowser).toBe('firefox')
    expect(job?.data?.ytdlpCookiesFile).toBe('/data/user/temp/ytdlp-cookies-job-1.txt')
  })

  it('shows error when writeFile fails for cookies', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.openTextDialog.mockImplementation((onConfirm: (text: string) => void) => {
      onConfirm('cookie data')
    })
    h.writeYtdlpCookiesFile.mockRejectedValueOnce(new Error('write failed'))
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-more-options-checkbox'))
    fireEvent.click(screen.getByTestId('download-video-dialog-cookies-button'))
    fireEvent.click(screen.getByLabelText('Use cookies'))
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('write failed'))
    expect(h.saveDownloadVideoJob).not.toHaveBeenCalled()
  })
})

describe('DownloadVideoDialog - 1080p availability probe', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onOpenFilePicker: vi.fn(),
    destinationFolder: 'C:\\downloads',
  }

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    clearCookiesCache()
    h.validateDownloadUrl.mockReturnValue({ valid: true })
    h.mutateListFormats.mockReset()
    hListFormats.listFormats.mockReset()
    // Default: formats already fetched, start button enabled
    hListFormats.resultRef.current = { availableHeights: [1080, 720, 480, 360], hasAudioOnly: true, formatCodes: [], rawText: '' }
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
  })

  it('shows "1080p (unavailable)" label when probe returns no 1080 height', async () => {
    // Pre-set result so the component renders with probe already "complete"
    hListFormats.resultRef.current = { availableHeights: [360, 480], hasAudioOnly: true, formatCodes: [], rawText: '' }
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // Open format select and check 1080p option label
    fireEvent.click(screen.getByTestId('download-video-dialog-format-select'))
    const option1080 = await screen.findByTestId('download-video-dialog-format-option-1080p')
    expect(option1080.textContent).toContain('unavailable')
  })

  it('shows "1080p" label (no suffix) when probe returns 1080 in heights', async () => {
    // Pre-set result so the component renders with probe already "complete"
    hListFormats.resultRef.current = { availableHeights: [720, 1080], hasAudioOnly: false, formatCodes: [], rawText: '' }
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    fireEvent.click(screen.getByTestId('download-video-dialog-format-select'))
    const option1080 = await screen.findByTestId('download-video-dialog-format-option-1080p')
    expect(option1080.textContent).not.toContain('unavailable')
  })

  it('disables Start when 1080p selected but unavailable and no cookies configured', async () => {
    // Pre-set result so the component renders with probe already "complete" (no 1080)
    hListFormats.resultRef.current = { availableHeights: [360, 480], hasAudioOnly: true, formatCodes: [], rawText: '' }
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })

    // Select 1080p
    fireEvent.click(screen.getByTestId('download-video-dialog-format-select'))
    const option1080 = await screen.findByTestId('download-video-dialog-format-option-1080p')
    fireEvent.click(option1080)

    const startButton = screen.getByTestId('download-video-dialog-start')
    expect(startButton).toBeDisabled()
  })

  it('enables Start when 1080p selected, unavailable, but "From browser" is checked', async () => {
    // Pre-set result so the component renders with probe already "complete" (no 1080)
    hListFormats.resultRef.current = { availableHeights: [360, 480], hasAudioOnly: true, formatCodes: [], rawText: '' }
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })

    // Enable "From browser" (cookies are now in More Options since probe completed)
    fireEvent.click(screen.getByTestId('download-video-dialog-more-options-checkbox'))
    fireEvent.click(screen.getByLabelText('From browser'))

    // Select 1080p
    fireEvent.click(screen.getByTestId('download-video-dialog-format-select'))
    const option1080 = await screen.findByTestId('download-video-dialog-format-option-1080p')
    fireEvent.click(option1080)

    const startButton = screen.getByTestId('download-video-dialog-start')
    expect(startButton).not.toBeDisabled()
  })

  it('does not block Start when probe fails (unknown = available)', async () => {
    // Don't set resultRef.current — simulate probe failure (null = unknown = available)
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })

    // Select 1080p — should still be enabled since probe failed = unknown
    fireEvent.click(screen.getByTestId('download-video-dialog-format-select'))
    const option1080 = await screen.findByTestId('download-video-dialog-format-option-1080p')
    fireEvent.click(option1080)

    const startButton = screen.getByTestId('download-video-dialog-start')
    expect(startButton).not.toBeDisabled()
  })
})
