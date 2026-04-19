import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MusicPanel } from './MusicPanel'
import { useUIMediaFolderStoreState } from '@/stores/uiMediaFolderStore'
import { useMediaMetadataQuery } from '@/hooks/mediaMetadata'
import { useDialogs } from '@/providers/dialog-provider'
import { openFile } from '@/api/openFile'
import { deleteFile } from '@/api/deleteFile'
import { getMediaTags } from '@/api/ffmpeg'
import { toast } from 'sonner'
import { Path } from '@core/path'
import type { DownloadVideoBackgroundJob } from '@/types/background-jobs'

vi.mock('@/stores/uiMediaFolderStore')
vi.mock('@/hooks/mediaMetadata')
vi.mock('@/hooks/mediaMetadata/useFetchMediaMetadataMutation', () => ({
  useFetchMediaMetadataMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
  }),
}))
vi.mock('@/hooks/mediaMetadata/useUpdateMediaMetadataMutation', () => ({
  useUpdateMediaMetadataMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  }),
}))
vi.mock('@/providers/dialog-provider')
vi.mock('@/api/openFile')
vi.mock('@/api/deleteFile')
vi.mock('@/api/ffmpeg')
vi.mock('sonner')

const jobsHolder: { jobs: DownloadVideoBackgroundJob[] } = {
  jobs: [
    {
      id: 'dj1',
      name: 'DL',
      status: 'running',
      progress: 0,
      type: 'download-video',
      data: {
        folder: '/media/music',
        videos: [
          {
            url: 'https://example.com/v',
            title: 'Queued Video Title',
            artist: '',
            status: 'pending',
          },
        ],
      },
    },
  ],
}

const mockJobRecords = [
  {
    id: 'dj1',
    name: 'DL',
    status: 'pending',
    progress: 0,
    type: 'download-video',
    folder: '/media/music',
    data: JSON.stringify({
      folder: '/media/music',
      videos: [
        {
          url: 'https://example.com/v',
          title: 'Queued Video Title',
          artist: '',
          status: 'pending',
        },
      ],
    }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

vi.mock('@/hooks/useDownloadManager', () => ({
  useDownloadManager: () => ({
    jobRecords: mockJobRecords,
    hasRunningDownload: false,
    startDownload: vi.fn(),
    stopDownload: vi.fn(),
    removeDownload: vi.fn(),
  }),
}))

vi.mock('@/stores/backgroundJobsStore', () => {
  const store = {
    getState: () => ({ jobs: jobsHolder.jobs }),
  }
  return {
    useBackgroundJobsStore: Object.assign(
      (selector: (s: { jobs: typeof jobsHolder.jobs }) => unknown) =>
        selector({ jobs: jobsHolder.jobs }),
      store
    ),
  }
})

const mockSelectedMediaMetadata = {
  mediaFolderPath: '/media/music',
  type: 'music-folder' as const,
  files: ['/media/music/song1.mp3'],
  status: 'ok' as const,
}

function mockQueryOk() {
  return {
    data: mockSelectedMediaMetadata,
    isError: false,
    isPending: false,
    fetchStatus: 'idle' as const,
  }
}

describe('MusicPanel download-video jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUIMediaFolderStoreState).mockReturnValue({
      folders: [{ path: '/media/music', status: 'idle', test: false }],
      selectedFolder: '/media/music',
    })
    vi.mocked(useMediaMetadataQuery).mockReturnValue(
      mockQueryOk() as ReturnType<typeof useMediaMetadataQuery>
    )
    vi.mocked(useDialogs).mockReturnValue({
      filePropertyDialog: [vi.fn(), vi.fn()],
      formatConverterDialog: [vi.fn(), vi.fn()],
      downloadVideoDialog: [vi.fn(), vi.fn()],
      confirmationDialog: [vi.fn(), vi.fn()],
      spinnerDialog: [vi.fn(), vi.fn()],
      configDialog: [vi.fn(), vi.fn()],
      openFolderDialog: [vi.fn(), vi.fn()],
      filePickerDialog: [vi.fn(), vi.fn()],
      mediaSearchDialog: [vi.fn(), vi.fn()],
      renameFileDialog: [vi.fn(), vi.fn()],
      renameFolderDialog: [vi.fn(), vi.fn()],
      scrapeDialog: [vi.fn(), vi.fn()],
      editMediaFileDialog: [vi.fn(), vi.fn()],
    })
    vi.mocked(openFile).mockResolvedValue({ data: {} as any, error: undefined })
    vi.mocked(deleteFile).mockResolvedValue({ data: { path: '/media/music/song1.mp3' }, error: undefined })
    vi.mocked(getMediaTags).mockResolvedValue({ tags: {}, duration: undefined, error: undefined })
    vi.mocked(toast).mockImplementation(() => 'id')
    vi.spyOn(Path, 'toPlatformPath').mockImplementation((p: string) => p)
  })

  it('renders a table row for items in download-video jobs targeting the folder', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MusicPanel />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Queued Video Title')).toBeInTheDocument()
    })
  })
})
