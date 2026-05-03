import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcribeTrackWithFeedback, transcribeTracksWithFeedback } from '@/lib/transcribeFeedback'
import { toast } from 'sonner'

const h = vi.hoisted(() => ({
  createTranscribeJob: vi.fn(() => 'transcribe-job-1'),
  markTranscribeJobRunning: vi.fn(),
  markTranscribeJobSucceeded: vi.fn(),
  markTranscribeJobFailed: vi.fn(),
  transcribeWithVideoCaptioner: vi.fn(),
}))

vi.mock('@/api/videocaptioner', () => ({
  transcribeWithVideoCaptioner: h.transcribeWithVideoCaptioner,
}))
vi.mock('sonner')

describe('transcribeFeedback', () => {
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
        markTranscribeJobRunning: h.markTranscribeJobRunning,
        markTranscribeJobSucceeded: h.markTranscribeJobSucceeded,
        markTranscribeJobFailed: h.markTranscribeJobFailed,
      }
    )
    expect(h.createTranscribeJob).toHaveBeenCalledWith(
      'Song One',
      expect.stringContaining('song1.mp3')
    )
    expect(h.markTranscribeJobRunning).toHaveBeenCalledWith('transcribe-job-1')
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
        markTranscribeJobRunning: h.markTranscribeJobRunning,
        markTranscribeJobSucceeded: h.markTranscribeJobSucceeded,
        markTranscribeJobFailed: h.markTranscribeJobFailed,
      }
    )
    expect(h.markTranscribeJobFailed).toHaveBeenCalledWith('transcribe-job-1')
    expect(toast.success).toHaveBeenCalledWith('Transcribe start: "Song One".')
    expect(toast.error).toHaveBeenCalledWith('Could not transcribe "Song One". process failed')
  })

  it('queues multiple tracks and executes transcribe sequentially', async () => {
    h.createTranscribeJob
      .mockReturnValueOnce('job-1')
      .mockReturnValueOnce('job-2')
    h.transcribeWithVideoCaptioner
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ error: 'second failed' })

    await transcribeTracksWithFeedback(
      [
        { title: 'Song One', path: '/media/music/song1.mp3' } as any,
        { title: 'Song Two', path: '/media/music/song2.mp3' } as any,
      ],
      {
        createTranscribeJob: h.createTranscribeJob,
        markTranscribeJobRunning: h.markTranscribeJobRunning,
        markTranscribeJobSucceeded: h.markTranscribeJobSucceeded,
        markTranscribeJobFailed: h.markTranscribeJobFailed,
      }
    )

    expect(h.createTranscribeJob).toHaveBeenNthCalledWith(1, 'Song One', expect.stringContaining('song1.mp3'))
    expect(h.createTranscribeJob).toHaveBeenNthCalledWith(2, 'Song Two', expect.stringContaining('song2.mp3'))
    expect(h.markTranscribeJobRunning).toHaveBeenNthCalledWith(1, 'job-1')
    expect(h.markTranscribeJobRunning).toHaveBeenNthCalledWith(2, 'job-2')
    expect(h.markTranscribeJobSucceeded).toHaveBeenCalledWith('job-1')
    expect(h.markTranscribeJobFailed).toHaveBeenCalledWith('job-2')
    expect(h.transcribeWithVideoCaptioner).toHaveBeenNthCalledWith(1, { mediaPath: expect.stringContaining('song1.mp3') })
    expect(h.transcribeWithVideoCaptioner).toHaveBeenNthCalledWith(2, { mediaPath: expect.stringContaining('song2.mp3') })
  })
})
