import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcribeTrackWithFeedback } from './MusicPanel'
import { toast } from 'sonner'

const h = vi.hoisted(() => ({
  createTranscribeJob: vi.fn(() => 'transcribe-job-1'),
  markTranscribeJobSucceeded: vi.fn(),
  markTranscribeJobFailed: vi.fn(),
  transcribeWithVideoCaptioner: vi.fn(),
}))

vi.mock('@/api/videocaptioner', () => ({
  transcribeWithVideoCaptioner: h.transcribeWithVideoCaptioner,
}))
vi.mock('sonner')

describe('MusicPanel transcribe feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(toast.success).mockImplementation(() => 'toast-id')
    vi.mocked(toast.error).mockImplementation(() => 'toast-id')
  })

  it('shows start and completion success toasts and marks job succeeded', async () => {
    h.transcribeWithVideoCaptioner.mockResolvedValue({ success: true })
    await transcribeTrackWithFeedback(
      { title: 'Song One', path: '/media/music/song1.mp3' } as any,
      {
        createTranscribeJob: h.createTranscribeJob,
        markTranscribeJobSucceeded: h.markTranscribeJobSucceeded,
        markTranscribeJobFailed: h.markTranscribeJobFailed,
      }
    )
    expect(h.createTranscribeJob).toHaveBeenCalledWith(
      'Song One',
      expect.stringContaining('song1.mp3')
    )
    expect(h.markTranscribeJobSucceeded).toHaveBeenCalledWith('transcribe-job-1')
    expect(toast.success).toHaveBeenCalledWith('Transcribe start: "Song One".')
    expect(toast.success).toHaveBeenCalledWith('Transcription completed for "Song One".')
  })

  it('shows start and failure toasts and marks job failed', async () => {
    h.transcribeWithVideoCaptioner.mockResolvedValue({ error: 'process failed' })
    await transcribeTrackWithFeedback(
      { title: 'Song One', path: '/media/music/song1.mp3' } as any,
      {
        createTranscribeJob: h.createTranscribeJob,
        markTranscribeJobSucceeded: h.markTranscribeJobSucceeded,
        markTranscribeJobFailed: h.markTranscribeJobFailed,
      }
    )
    expect(h.markTranscribeJobFailed).toHaveBeenCalledWith('transcribe-job-1')
    expect(toast.success).toHaveBeenCalledWith('Transcribe start: "Song One".')
    expect(toast.error).toHaveBeenCalledWith('Could not transcribe "Song One". process failed')
  })
})
