import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DownloadVideoDialog } from './download-video-dialog'

// Mock translation hook
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string }) => {
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

// Mock API and toast side effects – not the focus of these tests
vi.mock('@/api/ytdlp', () => ({
  downloadYtdlpVideo: vi.fn().mockResolvedValue({ success: true, path: '/mock/path' }),
  extractYtdlpVideoData: vi.fn().mockResolvedValue({ title: 'Mock Title', artist: 'Mock Artist' }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('DownloadVideoDialog - user agreement', () => {
  const mockOnClose = vi.fn()
  const mockOnStart = vi.fn()
  const mockOnOpenFilePicker = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onStart: mockOnStart,
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
    render(<DownloadVideoDialog {...defaultProps} />)

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
    render(<DownloadVideoDialog {...defaultProps} />)

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

    render(<DownloadVideoDialog {...defaultProps} />)

    // Agreement title should not be shown
    expect(screen.queryByText('Legal and licensing notice')).not.toBeInTheDocument()

    const urlInput = screen.getByLabelText('Video URL') as HTMLInputElement
    const folderInput = screen.getByLabelText('Download Folder') as HTMLInputElement

    expect(urlInput.disabled).toBe(false)
    expect(folderInput.disabled).toBe(false)
  })

  it('does not call onStart if user has not agreed, even when URL and folder look valid', () => {
    render(<DownloadVideoDialog {...defaultProps} />)

    const urlInput = screen.getByLabelText('Video URL') as HTMLInputElement
    const startButton = screen.getByText('Start') as HTMLButtonElement

    // Try typing via fireEvent even though the field is disabled;
    // component should still guard in handleStart using hasAgreed.
    fireEvent.change(urlInput, { target: { value: 'https://example.com/video' } })
    fireEvent.click(startButton)

    expect(mockOnStart).not.toHaveBeenCalled()
  })
})

