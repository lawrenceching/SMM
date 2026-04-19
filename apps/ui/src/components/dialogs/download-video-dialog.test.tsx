import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DownloadVideoDialog } from './download-video-dialog'

const h = vi.hoisted(() => ({
  saveDownloadVideoJob: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/downloadTaskDb', () => ({
  saveDownloadVideoJob: h.saveDownloadVideoJob,
}))

vi.mock('@/hooks/ytdlp/useYtdlpMutations', () => ({
  useBilibiliEpisodesMetadataMutation: () => ({
    mutate: vi.fn(),
    reset: vi.fn(),
  }),
  useExtractYtdlpVideoDataMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ title: 'Mock Title', artist: 'Mock Artist' }),
    reset: vi.fn(),
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
        'downloadVideo.episodesLoading': 'Loading episodes…',
      }
      return dialogsTranslations[key] || key
    },
  }),
}))

// Mock validateDownloadUrl to avoid depending on implementation details
vi.mock('@core/download-video-validators', () => ({
  validateDownloadUrl: (value: string) => ({
    valid: value.trim().length > 0,
    error: 'URL_EMPTY',
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
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
      target: { value: 'https://example.com/video' },
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
})
