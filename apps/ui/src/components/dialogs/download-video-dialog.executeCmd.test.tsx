/** @vitest-environment jsdom */
/**
 * Integration: Download Video Dialog → Core HTTP APIs.
 * Go → ytdlpInspectViaCore; Start → downloadVideoViaCore.
 */
import type { ReactElement } from 'react'
import { createContext } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DownloadVideoDialog } from './download-video-dialog'
import { clearCookiesCache } from '@/lib/ytdlpCookiesCache'

const QUICKJS_PATH = '/app/Resources/bin/quickjs/qjs'
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=test123'

const h = vi.hoisted(() => ({
  ytdlpInspectViaCore: vi.fn(),
  downloadVideoViaCore: vi.fn().mockResolvedValue('core-ytdlp-job-1'),
  pollYtdlpJob: vi.fn().mockResolvedValue({
    kind: 'ytdlp',
    id: 'core-ytdlp-job-1',
    type: 'ytdlp',
    url: 'https://www.youtube.com/watch?v=test123',
    folder: 'C:\\downloads',
    status: 'succeeded',
    progress: 100,
    createdAt: 0,
    updatedAt: 0,
  }),
  fetchDiscoverExecutables: vi.fn(),
  validateDownloadUrl: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/api/ytdlpInspect', () => ({
  ytdlpInspectViaCore: h.ytdlpInspectViaCore,
  ytdlpInspect: vi.fn(),
}))

vi.mock('@/api/downloadVideo', () => ({
  downloadVideoViaCore: h.downloadVideoViaCore,
  downloadVideo: vi.fn(),
}))

vi.mock('@/lib/pollYtdlpJob', () => ({
  pollYtdlpJob: h.pollYtdlpJob,
}))

vi.mock('@/api/discoverExecutables', () => ({
  fetchDiscoverExecutables: h.fetchDiscoverExecutables,
}))

vi.mock('@smm/core/download-video-validators', () => ({
  validateDownloadUrl: h.validateDownloadUrl,
}))

vi.mock('sonner', () => ({
  toast: {
    error: h.toastError,
    success: h.toastSuccess,
    info: vi.fn(),
  },
}))

vi.mock('@/providers/dialog-provider', () => ({
  DialogContext: createContext(undefined),
  useDialogs: () => ({
    textDialog: [vi.fn(), vi.fn()],
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
    patchUserConfig: vi.fn(),
    reload: vi.fn(),
    refreshUserConfig: vi.fn(),
    addMediaFolderInUserConfig: vi.fn(),
  }),
}))

vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/i18n')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => {
        const dialogs: Record<string, string> = {
          'downloadVideo.urlLabel': 'Video URL',
          'downloadVideo.folderLabel': 'Download Folder',
          'downloadVideo.start': 'Start',
          'downloadVideo.useCookiesFromBrowserLabel': 'From browser',
          'downloadVideo.errors.httpError':
            'Internal API server returned an error (HTTP {{status}}). Please try restarting the app. If the problem persists, contact the developer.',
          'downloadVideo.errors.executableNotFound':
            'Required executable not found. Please check the CLI installation.',
          'downloadVideo.errors.apiNetworkError':
            'Cannot reach the service. Please check your network.',
          'downloadVideo.errors.unknown':
            'Unknown error. Check the status bar task list for detailed logs.',
          'downloadVideo.cookiesRequiredForYoutube': 'YouTube requires cookies.',
          'downloadVideo.cookiesEmpty': 'Cookies empty',
          'downloadVideo.episodesNoneSelected': 'None selected',
          'downloadVideo.quickjsUnavailable': 'QuickJS unavailable',
          'downloadVideo.moreOptions.label': 'More options',
          'downloadVideo.useJsRuntimeLabel': 'Use JS Runtime',
          'downloadVideo.jsRuntimeQuickJS': 'QuickJS',
        }
        const template = dialogs[key] ?? key
        return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
          const v = opts?.[name]
          return v == null ? `{{${name}}}` : String(v)
        })
      },
    }),
  }
})

function makeTestVideoMetadata(heights: number[]) {
  return {
    id: 'test-video',
    title: 'Test Video',
    _type: 'video',
    fulltitle: 'Test Video',
    webpage_url: YOUTUBE_URL,
    formats: heights.map((height) => ({
      format_id: `${height}p`,
      ext: 'mp4',
      vcodec: 'avc1',
      acodec: 'none',
      height,
      width: 1920,
      fps: 30,
    })),
  }
}

function renderDialog(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('DownloadVideoDialog Core API integration', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onOpenFilePicker: vi.fn(),
    destinationFolder: 'C:\\downloads',
  }

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.clearAllMocks()
    clearCookiesCache()
    window.localStorage.clear()

    h.validateDownloadUrl.mockImplementation((value: string) => ({
      valid: value.trim().length > 0 && !value.includes('invalid'),
      error: 'URL_EMPTY',
    }))

    h.fetchDiscoverExecutables.mockResolvedValue({
      ytdlp: { configuredPath: null, discoveredPath: null },
      ffmpeg: { configuredPath: null, discoveredPath: null },
      videocaptioner: { configuredPath: null, discoveredPath: null },
      quickjs: { configuredPath: null, discoveredPath: QUICKJS_PATH },
    })

    h.ytdlpInspectViaCore.mockResolvedValue({
      video: makeTestVideoMetadata([1080, 720]),
    })
    h.downloadVideoViaCore.mockResolvedValue('core-ytdlp-job-1')
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('passes jsRuntimePath and cookiesFromBrowser to Core inspect and download', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')

    renderDialog(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.click(screen.getByTestId('download-video-dialog-use-cookies-from-browser-checkbox'))
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: YOUTUBE_URL },
    })

    fireEvent.click(screen.getByTestId('download-video-dialog-go-button'))

    await waitFor(() => {
      expect(h.ytdlpInspectViaCore).toHaveBeenCalled()
    })

    expect(h.ytdlpInspectViaCore).toHaveBeenCalledWith(
      expect.objectContaining({
        url: YOUTUBE_URL,
        cookiesFromBrowser: expect.any(String),
        jsRuntime: 'quickjs',
        jsRuntimePath: QUICKJS_PATH,
      }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-start')).not.toBeDisabled()
    })

    fireEvent.click(screen.getByTestId('download-video-dialog-start'))

    await waitFor(() => {
      expect(h.downloadVideoViaCore).toHaveBeenCalled()
    })

    expect(h.downloadVideoViaCore).toHaveBeenCalledWith(
      expect.objectContaining({
        url: YOUTUBE_URL,
        folder: 'C:\\downloads',
        cookiesFromBrowser: expect.any(String),
        jsRuntime: 'quickjs',
        jsRuntimePath: QUICKJS_PATH,
      }),
    )
  })

  describe('when ytdlp-inspect returns a classified error', () => {
    beforeEach(() => {
      window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')
    })

    async function triggerGoAndWaitForListingError(): Promise<HTMLElement> {
      fireEvent.click(screen.getByTestId('download-video-dialog-go-button'))
      return screen.findByTestId('download-video-dialog-listing-error', undefined, {
        timeout: 5000,
      })
    }

    it('shows a localized "unknown error (HTTP 500)" message for CLI 500', async () => {
      h.ytdlpInspectViaCore.mockRejectedValue(new Error('HTTP 500: Internal Server Error'))

      renderDialog(<DownloadVideoDialog {...defaultProps} />)
      fireEvent.change(screen.getByLabelText('Video URL'), {
        target: { value: YOUTUBE_URL },
      })
      fireEvent.click(screen.getByTestId('download-video-dialog-use-cookies-from-browser-checkbox'))

      const errEl = await triggerGoAndWaitForListingError()
      expect(errEl.textContent).toContain('Internal API server returned an error (HTTP 500)')
      expect(errEl.textContent).toContain('restarting the app')
    })

    it('shows a localized "unknown error (HTTP 400)" message for CLI 400 with body', async () => {
      h.ytdlpInspectViaCore.mockRejectedValue(new Error('HTTP 400: test'))

      renderDialog(<DownloadVideoDialog {...defaultProps} />)
      fireEvent.change(screen.getByLabelText('Video URL'), {
        target: { value: YOUTUBE_URL },
      })
      fireEvent.click(screen.getByTestId('download-video-dialog-use-cookies-from-browser-checkbox'))

      const errEl = await triggerGoAndWaitForListingError()
      expect(errEl.textContent).toContain('Internal API server returned an error (HTTP 400)')
    })

    it('shows a localized HTTP error message when Core returns 404', async () => {
      h.ytdlpInspectViaCore.mockRejectedValue(new Error('HTTP 404: Not Found'))

      renderDialog(<DownloadVideoDialog {...defaultProps} />)
      fireEvent.change(screen.getByLabelText('Video URL'), {
        target: { value: YOUTUBE_URL },
      })
      fireEvent.click(screen.getByTestId('download-video-dialog-use-cookies-from-browser-checkbox'))

      const errEl = await triggerGoAndWaitForListingError()
      expect(errEl.textContent).toContain('Internal API server returned an error (HTTP 404)')
    })

    it('shows a localized "api network error" message on browser fetch failure', async () => {
      h.ytdlpInspectViaCore.mockRejectedValue(new Error('Failed to fetch'))

      renderDialog(<DownloadVideoDialog {...defaultProps} />)
      fireEvent.change(screen.getByLabelText('Video URL'), {
        target: { value: YOUTUBE_URL },
      })
      fireEvent.click(screen.getByTestId('download-video-dialog-use-cookies-from-browser-checkbox'))

      const errEl = await triggerGoAndWaitForListingError()
      expect(errEl.textContent).toContain('Cannot reach the service')
    })

    it('appends the original error text for genuinely unknown errors', async () => {
      h.ytdlpInspectViaCore.mockRejectedValue(new Error('weird unrecoverable glitch xyz123'))

      renderDialog(<DownloadVideoDialog {...defaultProps} />)
      fireEvent.change(screen.getByLabelText('Video URL'), {
        target: { value: YOUTUBE_URL },
      })
      fireEvent.click(screen.getByTestId('download-video-dialog-use-cookies-from-browser-checkbox'))

      const errEl = await triggerGoAndWaitForListingError()
      expect(errEl.textContent).toContain('weird unrecoverable glitch xyz123')
    })
  })
})
