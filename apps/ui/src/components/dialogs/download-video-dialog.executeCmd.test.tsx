/** @vitest-environment jsdom */
/**
 * Integration: Download Video Dialog → JobOrchestrator → executeCmd boundary.
 * Uses real hooks + JobOrchestratorProvider; mocks stop at executeCmd helpers.
 */
import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JobOrchestratorProvider } from '@/components/JobOrchestratorProvider'
import { DownloadVideoDialog } from './download-video-dialog'
import { clearCookiesCache } from '@/lib/ytdlpCookiesCache'
import { deleteJob, getAllJobs } from '@/lib/downloadTaskDb'
import type { ExecuteCmdRequest } from '@/api/executeCmd'

const QUICKJS_PATH = '/app/Resources/bin/quickjs/qjs'
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=test123'

const h = vi.hoisted(() => ({
  executeCmdToCompletion: vi.fn(),
  executeCmdToCompletionWithHeaders: vi.fn(),
  fetchDiscoverExecutables: vi.fn(),
  validateDownloadUrl: vi.fn(),
  writeYtdlpCookiesFile: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/lib/whitelistedCmd/executeCmdToCompletion', () => ({
  executeCmdToCompletion: h.executeCmdToCompletion,
  executeCmdToCompletionWithHeaders: h.executeCmdToCompletionWithHeaders,
}))

vi.mock('@/lib/commandExecutionStatusPoller', () => ({
  pollCommandExecutionStatusAndReconcile: vi.fn().mockResolvedValue(undefined),
  COMMAND_EXECUTION_STATUS_POLL_MS: 60_000,
}))

vi.mock('@/api/discoverExecutables', () => ({
  fetchDiscoverExecutables: h.fetchDiscoverExecutables,
}))

vi.mock('@core/download-video-validators', () => ({
  validateDownloadUrl: h.validateDownloadUrl,
}))

vi.mock('@/lib/ytdlpCookiesFile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ytdlpCookiesFile')>()
  return {
    ...actual,
    writeYtdlpCookiesFile: h.writeYtdlpCookiesFile,
  }
})

vi.mock('sonner', () => ({
  toast: {
    error: h.toastError,
    success: h.toastSuccess,
    info: vi.fn(),
  },
}))

vi.mock('@/providers/dialog-provider', () => ({
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
    setAndSaveUserConfig: vi.fn(),
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
      t: (key: string) => {
        const dialogs: Record<string, string> = {
          'downloadVideo.urlLabel': 'Video URL',
          'downloadVideo.folderLabel': 'Download Folder',
          'downloadVideo.start': 'Start',
          'downloadVideo.useCookiesFromBrowserLabel': 'From browser',
          'downloadVideo.cookiesRequiredForYoutube': 'YouTube requires cookies.',
          'downloadVideo.cookiesEmpty': 'Cookies empty',
          'downloadVideo.cookiesWriteFailed': 'Cookies write failed',
          'downloadVideo.episodesNoneSelected': 'None selected',
          'downloadVideo.quickjsUnavailable': 'QuickJS unavailable',
          'downloadVideo.moreOptions.label': 'More options',
          'downloadVideo.useJsRuntimeLabel': 'Use JS Runtime',
          'downloadVideo.jsRuntimeQuickJS': 'QuickJS',
        }
        return dialogs[key] ?? key
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

function isListFormatsRequest(req: ExecuteCmdRequest): boolean {
  return req.command === 'yt-dlp' && req.args.includes('-J')
}

function isDownloadRequest(req: ExecuteCmdRequest): boolean {
  return req.command === 'yt-dlp' && req.args.includes('--print')
}

function renderWithOrchestrator(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <JobOrchestratorProvider>{ui}</JobOrchestratorProvider>
    </QueryClientProvider>,
  )
}

async function clearDownloadTaskDb() {
  const records = await getAllJobs()
  await Promise.all(records.map((r) => deleteJob(r.id)))
}

describe('DownloadVideoDialog executeCmd integration (scheme B)', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onOpenFilePicker: vi.fn(),
    destinationFolder: 'C:\\downloads',
  }

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.clearAllMocks()
    clearCookiesCache()
    await clearDownloadTaskDb()
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

    h.writeYtdlpCookiesFile.mockResolvedValue('/data/user/temp/ytdlp-cookies-job-1.txt')

    h.executeCmdToCompletion.mockImplementation(async (request: ExecuteCmdRequest) => {
      if (isListFormatsRequest(request)) {
        return {
          success: true,
          stdout: JSON.stringify(makeTestVideoMetadata([1080, 720])),
          stderr: '',
          exitCode: 0,
        }
      }
      return {
        success: false,
        stdout: '',
        stderr: `unexpected executeCmdToCompletion: ${request.args.join(' ')}`,
        exitCode: 1,
      }
    })

    h.executeCmdToCompletionWithHeaders.mockImplementation(async (request: ExecuteCmdRequest) => {
      if (isDownloadRequest(request)) {
        return {
          success: true,
          stdout: 'C:\\downloads\\Test Video [test-video].mp4',
          stderr: '',
          exitCode: 0,
          executionId: 'test-execution-id',
        }
      }
      return {
        success: false,
        stdout: '',
        stderr: `unexpected executeCmdToCompletionWithHeaders: ${request.args.join(' ')}`,
        exitCode: 1,
      }
    })
  })

  afterEach(async () => {
    await clearDownloadTaskDb()
    window.localStorage.clear()
  })

  it('passes --js-runtimes with QuickJS path through UI, hooks, and orchestrator to executeCmd', async () => {
    window.localStorage.setItem('DownloadVideoDialog.userAgreed', 'true')

    renderWithOrchestrator(<DownloadVideoDialog {...defaultProps} />)

    fireEvent.click(screen.getByTestId('download-video-dialog-use-cookies-from-browser-checkbox'))
    fireEvent.change(screen.getByLabelText('Video URL'), {
      target: { value: YOUTUBE_URL },
    })

    fireEvent.click(screen.getByTestId('download-video-dialog-go-button'))

    await waitFor(() => {
      expect(h.executeCmdToCompletion).toHaveBeenCalled()
    })

    const listCall = h.executeCmdToCompletion.mock.calls.find(([req]) => isListFormatsRequest(req))
    expect(listCall).toBeDefined()
    expect(listCall![0].args).toContain('--js-runtimes')
    expect(listCall![0].args).toContain(`quickjs:${QUICKJS_PATH}`)

    await waitFor(() => {
      expect(screen.getByTestId('download-video-dialog-start')).not.toBeDisabled()
    })

    fireEvent.click(screen.getByTestId('download-video-dialog-start'))

    await waitFor(
      () => {
        expect(h.executeCmdToCompletionWithHeaders).toHaveBeenCalled()
      },
      { timeout: 5000 },
    )

    const downloadCalls = h.executeCmdToCompletionWithHeaders.mock.calls.filter(([req]) =>
      isDownloadRequest(req),
    )
    expect(downloadCalls.length).toBeGreaterThanOrEqual(1)

    const downloadReq = downloadCalls[0]![0]
    expect(downloadReq.command).toBe('yt-dlp')
    expect(downloadReq.args).toContain('--js-runtimes')
    expect(downloadReq.args).toContain(`quickjs:${QUICKJS_PATH}`)
    expect(downloadReq.args).toContain(YOUTUBE_URL)
    expect(downloadReq.args).toContain('--cookies-from-browser')
  })
})
