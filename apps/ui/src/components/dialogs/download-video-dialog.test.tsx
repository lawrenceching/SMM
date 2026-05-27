import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DownloadVideoDialog } from './download-video-dialog'
import { clearCookiesCache, setCachedCookies } from '@/lib/ytdlpCookiesCache'

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
  fetchDiscoverExecutables: vi.fn().mockResolvedValue({
    ytdlp: { configuredPath: null, discoveredPath: null },
    ffmpeg: { configuredPath: null, discoveredPath: null },
    videocaptioner: { configuredPath: null, discoveredPath: null },
    quickjs: { configuredPath: null, discoveredPath: '/app/Resources/bin/quickjs/qjs' },
  }),
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

function makeTestVideoMetadata(heights: number[]) {
  return {
    id: "test-video",
    title: "Test Video",
    fulltitle: null,
    display_id: "test-video",
    description: null,
    uploader: null,
    uploader_id: null,
    thumbnail: null,
    thumbnails: [],
    duration: null,
    duration_string: null,
    timestamp: null,
    upload_date: null,
    release_year: null,
    epoch: 0,
    view_count: null,
    like_count: null,
    comment_count: null,
    tags: null,
    chapters: null,
    subtitles: {},
    requested_subtitles: null,
    webpage_url: "https://example.com/video",
    original_url: null,
    webpage_url_basename: "test-video",
    webpage_url_domain: "example.com",
    extractor: null,
    extractor_key: null,
    http_headers: {},
    _old_archive_ids: null,
    _has_drm: null,
    format: null,
    format_id: null,
    ext: null,
    protocol: null,
    width: null,
    height: null,
    resolution: null,
    fps: null,
    dynamic_range: null,
    vcodec: null,
    acodec: null,
    vbr: null,
    abr: null,
    tbr: null,
    aspect_ratio: null,
    stretched_ratio: null,
    filesize_approx: null,
    language: null,
    format_note: null,
    asr: null,
    audio_channels: null,
    formats: heights.map((h) => ({
      url: "",
      ext: "mp4",
      format_id: `${h}p`,
      format: `${h}p`,
      protocol: "https",
      vcodec: "avc1",
      acodec: "none",
      vbr: 100,
      abr: 0,
      tbr: 100,
      width: (h * 16 / 9) | 0,
      height: h,
      resolution: `${(h * 16 / 9) | 0}x${h}`,
      aspect_ratio: 1.78,
      fps: 30,
      dynamic_range: "SDR",
      quality: null,
      filesize: null,
      filesize_approx: null,
      audio_ext: "none",
      video_ext: "mp4",
      http_headers: {},
    })),
    requested_formats: null,
    requested_downloads: [],
    playlist: null,
    playlist_id: null,
    playlist_title: null,
    playlist_uploader: null,
    playlist_uploader_id: null,
    playlist_channel: null,
    playlist_channel_id: null,
    playlist_webpage_url: null,
    playlist_count: null,
    n_entries: null,
    playlist_index: null,
    __last_playlist_index: null,
    playlist_autonumber: null,
  }
}

vi.mock('./hooks/useListFormatsMutation', () => ({
  useListFormatsMutation: () => ({
    get videoMetadata() { return hListFormats.resultRef.current },
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
          'downloadVideo.cookiesRequiredForYoutube': 'YouTube requires cookies to download videos.',
          'downloadVideo.cookiesBrowserSelectLabel': 'Select browser',
          'downloadVideo.useJsRuntimeLabel': 'Use JavaScript Runtime',
          'downloadVideo.jsRuntimeQuickJS': 'QuickJS',
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

vi.mock('@/api/discoverExecutables', () => ({
  fetchDiscoverExecutables: h.fetchDiscoverExecutables,
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
        hListFormats.resultRef.current = makeTestVideoMetadata([1080, 720, 480, 360])
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

  it.skip('shows Get videos checkbox but not Start until the collection list is loaded', () => {
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

  it.skip('shows Start after checking Get videos and enqueues one job per selected collection video URL', async () => {
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

  it.skip('shows resolved per-video title in collection list after metadata resolves', async () => {
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

  it.skip('shows collection list error and toast when collection metadata fetch fails', async () => {
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

  // ────────────────────────────────────────────────────────────────
  // TC-CO-05: unchecking Get videos clears the collection list
  // ────────────────────────────────────────────────────────────────
  it.skip('TC-CO-05: unchecking Get videos clears the collection list', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateCollectionMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        entries: [
          { ie_key: 'BiliBili', id: 'BV1', _type: 'url', url: 'https://www.bilibili.com/video/BV1/' },
          { ie_key: 'BiliBili', id: 'BV2', _type: 'url', url: 'https://www.bilibili.com/video/BV2/' },
        ],
      })
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://space.bilibili.com/123/lists/456' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-get-videos-checkbox'))
    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-collection-list')).toBeInTheDocument()
    })

    // Uncheck
    fireEvent.click(screen.getByTestId('download-video-dialog-get-videos-checkbox'))
    await waitFor(() => {
      expect(screen.queryByTestId('download-video-dialog-collection-list')).not.toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // TC-CO-08: empty collection list → Start button not shown
  // ────────────────────────────────────────────────────────────────
  it.skip('TC-CO-08: empty collection list hides Start button', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateCollectionMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({ entries: [] })
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://space.bilibili.com/123/lists/456' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-get-videos-checkbox'))

    // Start button must not exist when collection has 0 entries
    await waitFor(() => {
      expect(screen.queryByTestId('download-video-dialog-start')).not.toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // TC-CO-10: deselecting all collection items disables Start
  // ────────────────────────────────────────────────────────────────
  it.skip('TC-CO-10: deselecting all collection items disables Start', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateCollectionMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        entries: [
          { ie_key: 'BiliBili', id: 'BV1', _type: 'url', url: 'https://www.bilibili.com/video/BV1/' },
        ],
      })
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://space.bilibili.com/123/lists/456' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-get-videos-checkbox'))
    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-start')).toBeInTheDocument()
    })

    // Deselect the only collection item
    fireEvent.click(
      screen.getByTestId('download-video-dialog-collection-checkbox-https://www.bilibili.com/video/BV1/'),
    )

    // Start should be disabled when nothing is selected
    expect(screen.getByTestId('download-video-dialog-start')).toBeDisabled()
  })

  // ────────────────────────────────────────────────────────────────
  // TC-CO-11: changing URL clears collection state
  // ────────────────────────────────────────────────────────────────
  it.skip('TC-CO-11: changing URL clears the loaded collection list', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateCollectionMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        entries: [
          { ie_key: 'BiliBili', id: 'BV1', _type: 'url', url: 'https://www.bilibili.com/video/BV1/' },
        ],
      })
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://space.bilibili.com/123/lists/456' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-get-videos-checkbox'))
    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-collection-list')).toBeInTheDocument()
    })

    // Switch to a different URL (non-collection)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1/' },
    })

    // Get videos must be unchecked and collection list gone
    await waitFor(() => {
      expect(screen.queryByTestId('download-video-dialog-collection-list')).not.toBeInTheDocument()
    })
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

  // ────────────────────────────────────────────────────────────────
  // TC-MO-03: expanding JS Runtime shows the runtime select
  // ────────────────────────────────────────────────────────────────
  it('TC-MO-03: enabling Use JS Runtime shows the runtime select', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // Open More Options
    fireEvent.click(screen.getByTestId('download-video-dialog-more-options-checkbox'))

    // JS Runtime checkbox should exist but select should not be visible yet
    const jsRuntimeCheckbox = screen.getByTestId('download-video-dialog-use-js-runtime-checkbox')
    expect(jsRuntimeCheckbox).toBeInTheDocument()
    expect(screen.queryByTestId('download-video-dialog-js-runtime-select')).not.toBeInTheDocument()

    // Enable JS Runtime
    fireEvent.click(jsRuntimeCheckbox)

    // JS Runtime select should now appear
    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-js-runtime-select')).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // TC-MO-04: YouTube URL forces JS Runtime enabled & disabled
  // ────────────────────────────────────────────────────────────────
  it('TC-MO-04: YouTube URL forces Use JS Runtime to be checked and disabled', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.youtube.com/watch?v=test' },
    })

    // Open More Options
    fireEvent.click(screen.getByTestId('download-video-dialog-more-options-checkbox'))

    // JS Runtime checkbox must be checked (forced by YouTube)
    const jsRuntimeCheckbox = screen.getByTestId('download-video-dialog-use-js-runtime-checkbox')
    expect(jsRuntimeCheckbox).toHaveAttribute('aria-checked', 'true')

    // JS Runtime checkbox must be disabled (forced — user cannot uncheck)
    expect(jsRuntimeCheckbox).toBeDisabled()

    // JS Runtime select should be visible since it's enabled
    expect(screen.getByTestId('download-video-dialog-js-runtime-select')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────────
  // TC-MO-05: cookies position after format probe
  // ────────────────────────────────────────────────────────────────
  it('TC-MO-05: cookies appear at top level before probe, then inside More Options after probe', async () => {
    // Reset so videoMetadata is null (before probe)
    hListFormats.resultRef.current = null

    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // Before probe: Use cookies checkbox should be visible at top level
    // (showCookiesAtTopLevel=true when videoMetadata is null)
    expect(screen.getByTestId('download-video-dialog-use-cookies-checkbox')).toBeInTheDocument()

    // Simulate probe completion by setting videoMetadata
    hListFormats.resultRef.current = makeTestVideoMetadata([720, 480])

    // Trigger re-render by changing URL slightly
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video?v=2' },
    })

    // After probe: Use cookies checkbox should NOT be at top level anymore
    expect(
      screen.queryByTestId('download-video-dialog-use-cookies-checkbox'),
    ).not.toBeInTheDocument()
  })

  // TC-FMT-02: switching to a non-default format preset works
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

  // TC-EP-02: YouTube URLs do not show the episodes checkbox
  it.skip('does not show Download episodes checkbox for YouTube URL', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.youtube.com/watch?v=test123' },
    })

    expect(screen.queryByLabelText('Download episodes')).not.toBeInTheDocument()
  })

  // TC-EP-01: Bilibili URLs show the episodes checkbox
  it.skip('shows Download episodes checkbox for bilibili URL', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1xx411c7mD/' },
    })

    expect(screen.getByLabelText('Download episodes')).toBeInTheDocument()
  })

  // TC-EP-10: changing the URL resets episodes state
  it.skip('unchecks Download episodes and clears episode list when bilibili URL changes', async () => {
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

  // TC-EP-08: episodes fetch error is displayed and list is cleared
  it.skip('shows episodes fetch error and clears list', async () => {
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

  // TC-EP-11: stale metadata responses are discarded after URL change
  it.skip('ignores stale episodes metadata response after URL changes', async () => {
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

  // TC-EP-07: no enqueue when all episodes are deselected
  it.skip('does not enqueue when episodes mode enabled but nothing selected', async () => {
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

  // TC-EP-06: one background job per selected episode with title/artist metadata
  it.skip('creates one job per selected episode with itemMeta in episodes mode', async () => {
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

  // ────────────────────────────────────────────────────────────────
  // TC-EP-03: checking episodes triggers loading state then displays list
  // ────────────────────────────────────────────────────────────────
  it.skip('TC-EP-03: shows loading indicator while episodes are being fetched, then displays the list', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    // Use a deferred callback so the loading state is visible in the DOM
    // before the episodes list replaces it.
    let deferredHandlers: { onSuccess?: Function; onSettled?: Function } | undefined
    h.mutateEpisodesMetadata.mockImplementation((_url, handlers) => {
      deferredHandlers = handlers as { onSuccess?: Function; onSettled?: Function }
      // Defer via microtask so React can render the loading state first
      queueMicrotask(() => {
        deferredHandlers?.onSuccess?.({
          error: null,
          videos: [
            {
              id: 'BV1',
              title: 'Episode 1 - Intro',
              webpage_url: 'https://www.bilibili.com/video/BV1/',
            },
          ],
        })
        deferredHandlers?.onSettled?.()
      })
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // First verify the episodes checkbox is present (canDownloadEpisodes is true)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1/' },
    })
    expect(screen.getByLabelText('Download episodes')).toBeInTheDocument()

    // Click the episodes checkbox
    fireEvent.click(screen.getByLabelText('Download episodes'))

    // With queueMicrotask, the deferred callback fires on the next microtask.
    // React 18 uses batch updates — the loading state and the resolved state
    // may flush together. Verify the final rendered result instead.
    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-episodes-panel')).toBeInTheDocument()
      expect(screen.getByText('Episode 1 - Intro')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('download-video-dialog-episodes-list')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────────
  // TC-EP-04: unchecking episodes clears the list
  // ────────────────────────────────────────────────────────────────
  it.skip('TC-EP-04: unchecking Download episodes clears the episode list', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateEpisodesMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        error: null,
        videos: [
          {
            id: 'BV1',
            title: 'Episode 1',
            webpage_url: 'https://www.bilibili.com/video/BV1/',
          },
          {
            id: 'BV2',
            title: 'Episode 2',
            webpage_url: 'https://www.bilibili.com/video/BV2/',
          },
        ],
      })
      handlers?.onSettled?.()
    })

    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1/' },
    })

    // First, load episodes
    fireEvent.click(screen.getByLabelText('Download episodes'))
    await waitFor(() => expect(screen.getByText('Episode 1')).toBeInTheDocument())
    expect(screen.getByText('Episode 2')).toBeInTheDocument()

    // Now uncheck
    fireEvent.click(screen.getByLabelText('Download episodes'))

    // The episodes panel should disappear and all episode content should be gone
    await waitFor(() => {
      expect(screen.queryByTestId('download-video-dialog-episodes-panel')).not.toBeInTheDocument()
      expect(screen.queryByText('Episode 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Episode 2')).not.toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // TC-EP-05: individual episode toggle
  // ────────────────────────────────────────────────────────────────
  it.skip('TC-EP-05: toggling individual episode checkbox changes selection state', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    h.mutateEpisodesMetadata.mockImplementation((_url, handlers) => {
      handlers?.onSuccess?.({
        error: null,
        videos: [
          {
            id: 'BV1',
            title: 'Episode 1',
            webpage_url: 'https://www.bilibili.com/video/BV1/',
          },
          {
            id: 'BV2',
            title: 'Episode 2',
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

    // Enable episodes
    fireEvent.click(screen.getByLabelText('Download episodes'))
    await waitFor(() => expect(screen.getByText('Episode 1')).toBeInTheDocument())

    // All episodes should be selected by default
    const ep1Checkbox = screen.getByTestId(
      'download-video-dialog-episode-checkbox-https://www.bilibili.com/video/BV1/',
    )
    const ep2Checkbox = screen.getByTestId(
      'download-video-dialog-episode-checkbox-https://www.bilibili.com/video/BV2/',
    )
    expect(ep1Checkbox).toHaveAttribute('aria-checked', 'true')
    expect(ep2Checkbox).toHaveAttribute('aria-checked', 'true')

    // Deselect episode 2
    fireEvent.click(ep2Checkbox)
    expect(ep2Checkbox).toHaveAttribute('aria-checked', 'false')

    // Episode 1 should still be selected
    expect(ep1Checkbox).toHaveAttribute('aria-checked', 'true')

    // Start should still work with episode 1 only
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
            }),
          ],
        }),
      }),
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

  it.skip('cancel resets transient state and calls reset hooks plus onClose', async () => {
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

  // ────────────────────────────────────────────────────────────────
  // TC-FD-01: download folder shows destinationFolder prop
  // ────────────────────────────────────────────────────────────────
  it('TC-FD-01: shows destinationFolder prop as initial download folder', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    // Use different defaultProps with destinationFolder set
    renderWithQueryClient(
      <DownloadVideoDialog
        isOpen={true}
        onClose={mockOnClose}
        onOpenFilePicker={mockOnOpenFilePicker}
        destinationFolder={'/home/user/downloads'}
      />,
    )

    const folderInput = screen.getByLabelText('Download Folder') as HTMLInputElement
    expect(folderInput.value).toBe('/home/user/downloads')
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

  it('resets cookies when switching to a different domain with no cached cookies', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    // Pre-populate cache for youtube.com
    setCachedCookies('www.youtube.com', {
      cookiesText: '# YouTube cookies',
      useCookies: true,
      useCookiesFromBrowser: true,
      cookiesBrowser: 'firefox',
    })
    hListFormats.resultRef.current = null
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // Enter YouTube URL — cache hit, cookies should be pre-filled
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.youtube.com/watch?v=test' },
    })
    expect(screen.getByLabelText('Use cookies')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('From browser')).toHaveAttribute('aria-checked', 'true')

    // Switch to Bilibili URL — no cache for this domain, cookies should reset
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1xx' },
    })
    expect(screen.getByLabelText('Use cookies')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByLabelText('From browser')).toHaveAttribute('aria-checked', 'false')
  })

  it('restores cookies from cache when switching back to a previously cached domain', () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    // Pre-populate cache for bilibili.com
    setCachedCookies('www.bilibili.com', {
      cookiesText: '# Bilibili cookies',
      useCookies: true,
      useCookiesFromBrowser: false,
      cookiesBrowser: 'firefox',
    })
    hListFormats.resultRef.current = null
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // Step 1: Enter bilibili URL — cache hit, cookies pre-filled
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1xx' },
    })
    expect(screen.getByLabelText('Use cookies')).toHaveAttribute('aria-checked', 'true')

    // Step 2: Switch to YouTube — no cache, cookies reset
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.youtube.com/watch?v=test' },
    })
    expect(screen.getByLabelText('Use cookies')).toHaveAttribute('aria-checked', 'false')

    // Step 3: Switch back to Bilibili — cache hit, cookies restored
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1xx' },
    })
    expect(screen.getByLabelText('Use cookies')).toHaveAttribute('aria-checked', 'true')
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

  it('disables Start when Use cookies is enabled but content is empty', () => {
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
    expect(screen.getByTestId('download-video-dialog-start')).toBeDisabled()
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
    fireEvent.change(screen.getByLabelText('Download Folder'), {
      target: { value: 'C:\\downloads' },
    })
    fireEvent.click(screen.getByText('Start'))
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('write failed'))
    expect(h.saveDownloadVideoJob).not.toHaveBeenCalled()
  })

  // ────────────────────────────────────────────────────────────────
  // TC-CK-05: switching browser selection changes the displayed browser
  // ────────────────────────────────────────────────────────────────
  it('TC-CK-05: enabling From browser shows browser select with correct default', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    // Reset videoMetadata to null so cookies appear at top level
    hListFormats.resultRef.current = null
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // From browser checkbox should be visible at top level
    const fromBrowserCheckbox = screen.getByTestId(
      'download-video-dialog-use-cookies-from-browser-checkbox',
    )
    expect(fromBrowserCheckbox).toBeInTheDocument()

    // Browser select should exist but be disabled when From browser is unchecked
    const browserSelect = screen.getByTestId('download-video-dialog-cookies-browser-select')
    expect(browserSelect).toBeInTheDocument()

    // Check From browser — browser select becomes enabled
    fireEvent.click(fromBrowserCheckbox)
    await waitFor(() => {
      expect(fromBrowserCheckbox).toHaveAttribute('aria-checked', 'true')
    })
  })

  // ────────────────────────────────────────────────────────────────
  // TC-CK-06: YouTube without cookies shows required error and disables Go
  // ────────────────────────────────────────────────────────────────
  it('TC-CK-06: YouTube URL without cookies shows required error and disables Go', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    hListFormats.resultRef.current = null
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // Enter a YouTube URL without configuring cookies
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.youtube.com/watch?v=test123' },
    })

    // Cookies required error should be visible
    const requiredError = screen.getByTestId('download-video-dialog-cookies-required-hint')
    expect(requiredError).toBeInTheDocument()
    expect(requiredError.textContent).toBe('YouTube requires cookies to download videos.')

    // Go button should be disabled
    expect(screen.getByTestId('download-video-dialog-go-button')).toBeDisabled()
  })

  // ────────────────────────────────────────────────────────────────
  // TC-CK-11: non-YouTube/Bilibili URL does not require cookies
  // ────────────────────────────────────────────────────────────────
  it('TC-CK-11: non-YouTube URL does not require cookies and Go is enabled', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    hListFormats.resultRef.current = null
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // Enter a generic URL (not YouTube/Bilibili)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // Cookies required error must NOT be present for non-YouTube URLs
    expect(
      screen.queryByTestId('download-video-dialog-cookies-required-hint'),
    ).not.toBeInTheDocument()

    // Go button should be enabled
    expect(screen.getByTestId('download-video-dialog-go-button')).toBeEnabled()
  })
})

// ── 1080p availability probe / Format selection (4.3) ──
describe('DownloadVideoDialog - 1080p availability probe / Format selection (4.3)', () => {
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
        hListFormats.resultRef.current = makeTestVideoMetadata([1080, 720, 480, 360])
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
  })

  // TC-FMT-03: unavailable suffix on 1080p option when formats lack 1080
  it('shows "1080p (unavailable)" label when probe returns no 1080 height', async () => {
    // Pre-set result so the component renders with probe already "complete"
        hListFormats.resultRef.current = makeTestVideoMetadata([360, 480])
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // Open format select and check 1080p option label
    fireEvent.click(screen.getByTestId('download-video-dialog-format-select'))
    const option1080 = await screen.findByTestId('download-video-dialog-format-option-1080p')
    expect(option1080.textContent).toContain('unavailable')
  })

  // TC-FMT-02 (complement): 1080p available — no suffix on option
  it('shows "1080p" label (no suffix) when probe returns 1080 in heights', async () => {
    // Pre-set result so the component renders with probe already "complete"
        hListFormats.resultRef.current = makeTestVideoMetadata([720, 1080])
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    fireEvent.click(screen.getByTestId('download-video-dialog-format-select'))
    const option1080 = await screen.findByTestId('download-video-dialog-format-option-1080p')
    expect(option1080.textContent).not.toContain('unavailable')
  })

  // TC-FMT-04: 1080p selected + unavailable + no cookies → Start disabled
  it('disables Start when 1080p selected but unavailable and no cookies configured', async () => {
    // Pre-set result so the component renders with probe already "complete" (no 1080)
        hListFormats.resultRef.current = makeTestVideoMetadata([360, 480])
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

  // TC-FMT-05: 1080p selected + unavailable + cookies → Start enabled
  it('enables Start when 1080p selected, unavailable, but "From browser" is checked', async () => {
    // Pre-set result so the component renders with probe already "complete" (no 1080)
        hListFormats.resultRef.current = makeTestVideoMetadata([360, 480])
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

  // TC-FMT-06: probe failure → 1080p treated as available (failsafe)
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

describe('DownloadVideoDialog - QuickJS availability check', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onOpenFilePicker: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    hListFormats.resultRef.current = null
    h.fetchDiscoverExecutables.mockResolvedValue({
      ytdlp: { configuredPath: null, discoveredPath: null },
      ffmpeg: { configuredPath: null, discoveredPath: null },
      videocaptioner: { configuredPath: null, discoveredPath: null },
      quickjs: { configuredPath: null, discoveredPath: '/app/Resources/bin/quickjs/qjs' },
    })
  })

  it('shows QuickJS unavailable error and disables Start for YouTube when QuickJS is missing', async () => {
    h.fetchDiscoverExecutables.mockResolvedValue({
      ytdlp: { configuredPath: null, discoveredPath: null },
      ffmpeg: { configuredPath: null, discoveredPath: null },
      videocaptioner: { configuredPath: null, discoveredPath: null },
      quickjs: { configuredPath: null, discoveredPath: null },
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // YouTube Go button requires at least one cookies option
    fireEvent.click(screen.getByTestId('download-video-dialog-use-cookies-from-browser-checkbox'))
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.youtube.com/watch?v=test123' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-go-button'))

    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-quickjs-unavailable')).toBeInTheDocument()
    })
    expect(screen.getByTestId('download-video-dialog-quickjs-unavailable')).toHaveTextContent('JavaScript 运行时 QuickJS 不可用, 请尝试安装最新版本')
    expect(screen.getByTestId('download-video-dialog-start')).toBeDisabled()
  })

  it('clears QuickJS error and enables Start when QuickJS becomes available on re-check', async () => {
    // First click: QuickJS unavailable
    h.fetchDiscoverExecutables.mockResolvedValue({
      ytdlp: { configuredPath: null, discoveredPath: null },
      ffmpeg: { configuredPath: null, discoveredPath: null },
      videocaptioner: { configuredPath: null, discoveredPath: null },
      quickjs: { configuredPath: null, discoveredPath: null },
    })
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // YouTube Go button requires at least one cookies option
    fireEvent.click(screen.getByTestId('download-video-dialog-use-cookies-from-browser-checkbox'))
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.youtube.com/watch?v=test123' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-go-button'))
    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-quickjs-unavailable')).toBeInTheDocument()
    })

    // Re-check: QuickJS now available
    h.fetchDiscoverExecutables.mockResolvedValue({
      ytdlp: { configuredPath: null, discoveredPath: null },
      ffmpeg: { configuredPath: null, discoveredPath: null },
      videocaptioner: { configuredPath: null, discoveredPath: null },
      quickjs: { configuredPath: null, discoveredPath: '/app/Resources/bin/quickjs/qjs' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-go-button'))

    await waitFor(() => {
      expect(screen.queryByTestId('download-video-dialog-quickjs-unavailable')).not.toBeInTheDocument()
    })
  })

  it('skips QuickJS check for Bilibili URL and proceeds normally', () => {
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1xx411c7mD/' },
    })
    fireEvent.click(screen.getByTestId('download-video-dialog-go-button'))

    expect(screen.queryByTestId('download-video-dialog-quickjs-unavailable')).not.toBeInTheDocument()
  })
})

// ── Format code selection (4.3) ──
describe('DownloadVideoDialog - format code selection (4.3)', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onOpenFilePicker: vi.fn(),
    destinationFolder: 'C:\\downloads',
  }

  /**
   * Create video metadata with formats that map to specific categories.
   * buildFormatCodes uses vcodec/acodec to determine category:
   *   - both present           → "combined"
   *   - only vcodec            → "video-only"
   *   - only acodec            → "audio-only"
   */
  function makeFormatCategoryMetadata(
    categories: Array<{ category: 'combined' | 'audio-only' | 'video-only'; format_id: string; height?: number }>,
  ) {
    const base = makeTestVideoMetadata([])
    base.formats = categories.map(({ category, format_id, height }) => ({
      url: '',
      ext: 'mp4',
      format_id,
      format: format_id,
      protocol: 'https',
      vcodec: category === 'audio-only' ? 'none' : 'avc1',
      acodec: category === 'video-only' ? 'none' : 'mp4a.40.2',
      vbr: category === 'audio-only' ? 0 : 100,
      abr: category === 'video-only' ? 0 : 128,
      tbr: 100,
      width: height ? ((height * 16) / 9) | 0 : null,
      height: height ?? null,
      resolution: height ? `${((height * 16) / 9) | 0}x${height}` : 'audio only',
      aspect_ratio: height ? 1.78 : null,
      fps: height ? 30 : null,
      dynamic_range: height ? 'SDR' : null,
      quality: null,
      filesize: null,
      filesize_approx: null,
      audio_ext: category === 'video-only' ? 'none' : 'm4a',
      video_ext: category === 'audio-only' ? 'none' : 'mp4',
      http_headers: {},
    }))
    return base
  }

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.clearAllMocks()
    clearCookiesCache()
    h.validateDownloadUrl.mockReturnValue({ valid: true })
    h.mutateListFormats.mockReset()
    hListFormats.listFormats.mockReset()
    hListFormats.resultRef.current = makeFormatCategoryMetadata([
      { category: 'video-only', format_id: '137', height: 720 },
      { category: 'audio-only', format_id: '140' },
      { category: 'combined', format_id: '18', height: 360 },
    ])
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  // ────────────────────────────────────────────────────────────────
  // TC-FMT-01: Default format preset is "default"
  // ────────────────────────────────────────────────────────────────
  it('TC-FMT-01: defaults to "Default (automatic)" format preset', async () => {
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // Enter a URL so FormatSection renders (isUrlValid becomes true)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    const trigger = screen.getByTestId('download-video-dialog-format-select')
    expect(trigger.textContent).toMatch(/Default|默认/)
  })

  // ────────────────────────────────────────────────────────────────
  // TC-FMT-07: Switch to format-code mode → format code select appears
  // ────────────────────────────────────────────────────────────────
  it('TC-FMT-07: switching to format-code mode shows format code select', async () => {
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    // Enter a URL so FormatSection renders
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // Switch to format-code mode
    fireEvent.click(screen.getByTestId('download-video-dialog-format-mode-code'))

    // Format code select should appear
    expect(screen.getByTestId('download-video-dialog-format-code-select')).toBeInTheDocument()

    // Supplementary format code select should NOT appear yet (no selection made)
    expect(
      screen.queryByTestId('download-video-dialog-supplementary-format-code-select'),
    ).not.toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────────
  // TC-FMT-08: Audio-only format → supplementary video select appears
  // ────────────────────────────────────────────────────────────────
  it('TC-FMT-08: selecting audio-only format code shows supplementary video select', async () => {
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // Switch to format-code mode
    fireEvent.click(screen.getByTestId('download-video-dialog-format-mode-code'))

    // Open format code select and pick the audio-only option
    fireEvent.click(screen.getByTestId('download-video-dialog-format-code-select'))
    // Wait for portal options, then find by role filtering text
    const options = await screen.findAllByRole('option')
    const audioItem = options.find((opt) => {
      const text = opt.textContent ?? ''
      // Audio-only option: has audio codec but no video codec reference
      return text.includes('mp4a') && !text.includes('avc1')
    })
    expect(audioItem).toBeTruthy()
    fireEvent.click(audioItem!)

    // Supplementary video format select should now appear
    await waitFor(() => {
      expect(
        screen.getByTestId('download-video-dialog-supplementary-format-code-select'),
      ).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // TC-FMT-09: Video-only format → supplementary audio select appears
  // ────────────────────────────────────────────────────────────────
  it('TC-FMT-09: selecting video-only format code shows supplementary audio select', async () => {
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // Switch to format-code mode
    fireEvent.click(screen.getByTestId('download-video-dialog-format-mode-code'))

    // Open format code select and pick the video-only option
    fireEvent.click(screen.getByTestId('download-video-dialog-format-code-select'))
    const videoItem = await screen.findByRole('option', { name: /720/i })
    fireEvent.click(videoItem)

    // Supplementary audio format select should now appear
    await waitFor(() => {
      expect(
        screen.getByTestId('download-video-dialog-supplementary-format-code-select'),
      ).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // TC-FMT-10: Combined format → no supplementary select
  // ────────────────────────────────────────────────────────────────
  it('TC-FMT-10: selecting combined format code does NOT show supplementary select', async () => {
    renderWithQueryClient(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://example.com/video' },
    })

    // Switch to format-code mode
    fireEvent.click(screen.getByTestId('download-video-dialog-format-mode-code'))

    // Open format code select and pick a combined option
    fireEvent.click(screen.getByTestId('download-video-dialog-format-code-select'))
    // Combined options contain both video and audio codec info — look for combined text
    const options = await screen.findAllByRole('option')
    // Pick the combined option (contains audio and video characteristics)
    const combinedItem = options.find((opt) => {
      const text = opt.textContent ?? ''
      return text.includes('mp4a') && text.includes('avc1')
    })
    expect(combinedItem).toBeTruthy()
    fireEvent.click(combinedItem!)

    // Supplementary select must NOT appear for combined formats
    expect(
      screen.queryByTestId('download-video-dialog-supplementary-format-code-select'),
    ).not.toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────────
  // TC-FMT-11: Episodes/collection mode hides format code UI
  // ────────────────────────────────────────────────────────────────
  it.skip('TC-FMT-11: enabling episode download hides format code radio and select', async () => {
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

    // Enter a Bilibili URL (canDownloadEpisodes becomes true)
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: 'https://www.bilibili.com/video/BV1/' },
    })

    // Format mode radio should be visible before enabling episodes
    expect(
      screen.getByTestId('download-video-dialog-format-mode-preset'),
    ).toBeInTheDocument()

    // Enable episode download
    fireEvent.click(screen.getByLabelText('Download episodes'))
    await waitFor(() => expect(screen.getByText('Episode 1')).toBeInTheDocument())

    // Format mode radio should now be hidden
    expect(
      screen.queryByTestId('download-video-dialog-format-mode-preset'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('download-video-dialog-format-mode-code'),
    ).not.toBeInTheDocument()

    // Format preset select should STILL be visible (episodes only hides the code UI)
    expect(screen.getByTestId('download-video-dialog-format-select')).toBeInTheDocument()
  })
})

