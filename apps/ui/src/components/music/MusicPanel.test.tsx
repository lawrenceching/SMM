import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MusicPanel } from './MusicPanel';
import { useUIMediaFolderStoreState } from '@/stores/uiMediaFolderStore';
import { useMediaMetadataQuery } from '@/hooks/mediaMetadata';
import { useDialogs } from '@/providers/dialog-provider';
import { toast } from 'sonner';
import { openFile } from '@/api/openFile';
import { moveFileToTrash } from '@/api/moveFileToTrash';
import type { Track } from '../MediaPlayer';
import { Path } from '@core/path';
import { getMediaTags } from '@/api/ffmpeg';
import { useVideoCaptionerStatus } from '@/hooks/useVideoCaptionerStatus';
import { useFeatures } from '@/hooks/useFeatures';
import { convertMusicFilesToTracks } from '@/lib/music';

const NESTED_FILE_POSIX = '/path/to/music/a/b/c/d/test.mp4';
const NESTED_FILE_PLATFORM = '/path/to/music/a/b/c/d/test.mp4';

const h = vi.hoisted(() => ({
  mockFetchMediaMetadata: vi.fn(),
  mockSaveMediaMetadata: vi.fn(),
  mockOpenFormatConverter: vi.fn(),
  emptyJobRecords: [] as const,
  emptyJobTracks: [] as const,
  emptyFileStatuses: {
    runningPaths: new Set<string>(),
    pendingPaths: new Set<string>(),
    failedPaths: new Set<string>(),
    jobIdsByPath: new Map<string, string[]>(),
    primaryJobIdByPath: new Map<string, string>(),
  },
  libraryTracks: [
    {
      id: 1,
      title: 'Test Song',
      artist: 'Test Artist',
      duration: 180,
      thumbnail: 'https://example.com/thumbnail.jpg',
      addedDate: new Date('2024-01-01'),
      path: '/path/to/song.mp3',
    },
  ],
}));

vi.mock('@/lib/mediaMetadataQueryKeys', () => ({
  normalizeMediaFolderPathForQuery: (p: string) => p,
  mediaMetadataQueryKey: (p: string) => ['mediaMetadata', p] as const,
  mediaMetadataReadQueryOptions: vi.fn(() => ({
    queryKey: ['mediaMetadata', ''] as const,
    queryFn: vi.fn(),
  })),
}))

vi.mock('@/lib/music', () => ({
  convertMusicFilesToTracks: vi.fn(() => h.libraryTracks),
  newMusicMediaMetadata: vi.fn((mm: { files?: string[] }) => ({
    ...mm,
    musicFiles: [],
  })),
}))

vi.mock('@/helpers/music/tracksFromDownloadVideoJobs', () => ({
  mergeLibraryTracksWithJobTracks: (libraryTracks: unknown[], jobTracks: unknown[]) => [
    ...libraryTracks,
    ...jobTracks,
  ],
  tracksFromDownloadJobRecords: () => h.emptyJobTracks,
}))

vi.mock('@/lib/transcribeDialogRows', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/transcribeDialogRows')>();
  return {
    ...actual,
    transcribeDialogRowsFromMusicFileRows: vi.fn(() => []),
  };
})

vi.mock('@/lib/subtitleTranslationDialogRows', () => ({
  subtitleTranslationDialogRowsFromMusicFileRows: vi.fn(() => []),
}))

vi.mock('@/lib/synthesizeSubtitleDialogRows', () => ({
  synthesizeSubtitleDialogRowsFromMusicFileRows: vi.fn(() => []),
}))

vi.mock('@/lib/processPipelineDialogRows', () => ({
  processPipelineDialogRowsFromMusicFileRows: vi.fn(() => []),
}))

vi.mock('@/stores/uiMediaFolderStore', () => ({
  useUIMediaFolderStoreState: vi.fn(),
}));

vi.mock('@/hooks/mediaMetadata', () => ({
  useMediaMetadataQuery: vi.fn(),
}));

vi.mock('@/hooks/mediaMetadata/useFetchMediaMetadataMutation', () => ({
  useFetchMediaMetadataMutation: () => ({
    mutateAsync: h.mockFetchMediaMetadata,
  }),
}));

vi.mock('@/hooks/mediaMetadata/useUpdateMediaMetadataMutation', () => ({
  useUpdateMediaMetadataMutation: () => ({
    mutateAsync: h.mockSaveMediaMetadata,
  }),
}));

vi.mock('@/providers/dialog-provider', () => ({
  useDialogs: vi.fn(),
}))
vi.mock('@/api/openFile', () => ({
  openFile: vi.fn(),
}))
vi.mock('@/api/moveFileToTrash', () => ({
  moveFileToTrash: vi.fn(),
}))
vi.mock('@/api/ffmpeg', () => ({
  getMediaTags: vi.fn(),
}))
vi.mock('@/api/videocaptioner', () => ({
  transcribeWithVideoCaptioner: vi.fn(),
}));
vi.mock('@/hooks/useVideoCaptionerStatus', () => ({
  useVideoCaptionerStatus: vi.fn(),
}));
vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: vi.fn(() => ({
    isAiFeatureEnabled: true,
    isTranscribeEnabled: true,
    isSubtitleFeaturesEnabled: true,
    isDownloadVideoEnabled: true,
    isFormatConverterEnabled: true,
    isVideoCompressionEnabled: true,
    isVideoCaptionerAsrOptionsEnabled: false,
    setVideoCaptionerAsrOptionsEnabled: vi.fn(),
    isTencentAsrTranscribeEnabled: false,
    setTencentAsrTranscribeEnabled: vi.fn(),
  })),
}));
vi.mock('sonner');
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string, options?: Record<string, string>) => {
      if (options) {
        return Object.entries(options).reduce(
          (s, [k, v]) => s.replace(`{{${k}}}`, v),
          defaultValue ?? key,
        );
      }
      return defaultValue ?? key;
    },
  }),
}));
vi.mock('../MusicFileTable', () => ({
  MusicFileTable: () => null,
}));
vi.mock('./MusicHeaderV2', () => ({
  MusicHeaderV2: () => null,
}));
vi.mock('../LocalFileSubtitleScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../LocalFileSubtitleScope')>();
  return {
    ...actual,
    LocalFileSubtitleScope: ({ children }: { children: React.ReactNode }) => children,
    useLocalFileSubtitle: () => actual.createMockLocalFileSubtitleContext(),
  };
});
vi.mock('../MediaPanelInitializingHint', () => ({
  MediaPanelInitializingHint: () => null,
}));
vi.mock('@/components/dialogs', () => ({
  DeleteTrackDialog: () => null,
  TranscribeDialog: () => null,
  SubtitleTranslationDialog: () => null,
  SynthesizeSubtitleDialog: () => null,
  ProcessPipelineDialog: () => null,
}));
vi.mock('@/hooks/useJobOrchestrator', () => ({
  useJobManager: () => ({
    isReady: true,
    createJob: vi.fn(),
    createJobs: vi.fn(),
    startJob: vi.fn(),
    stopJob: vi.fn(),
    removeJob: vi.fn(),
  }),
  useJobOrchestrator: () => ({
    isReady: true,
    createJob: vi.fn(),
    createJobs: vi.fn(),
    startJob: vi.fn(),
    stopJob: vi.fn(),
    removeJob: vi.fn(),
  }),
  useFileStatuses: () => h.emptyFileStatuses,
  useJobs: () => h.emptyJobRecords,
}));

const mockTrack: Track = {
  id: 1,
  title: 'Test Song',
  artist: 'Test Artist',
  duration: 180,
  thumbnail: 'https://example.com/thumbnail.jpg',
  addedDate: new Date('2024-01-01'),
  path: '/path/to/song.mp3',
};

const mockSelectedMediaMetadata = {
  mediaFolderPath: '/media/music',
  type: 'music-folder' as const,
  files: ['/media/music/song1.mp3', '/media/music/song2.mp3'],
  status: 'ok' as const,
};

function mockQueryOk(data: typeof mockSelectedMediaMetadata) {
  return {
    data,
    isError: false,
    isPending: false,
    fetchStatus: 'idle' as const,
  };
}

describe('MusicPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    h.mockFetchMediaMetadata.mockResolvedValue(mockSelectedMediaMetadata);
    h.mockSaveMediaMetadata.mockResolvedValue(undefined);

    vi.mocked(useUIMediaFolderStoreState).mockReturnValue({
      folders: [{ path: '/media/music', status: 'idle', test: false }],
      selectedFolder: '/media/music',
    });
    vi.mocked(useMediaMetadataQuery).mockReturnValue(mockQueryOk(mockSelectedMediaMetadata) as ReturnType<typeof useMediaMetadataQuery>);

    h.mockOpenFormatConverter.mockReset();

    vi.mocked(useDialogs).mockReturnValue({
      mediaFilePropertyDialog: [vi.fn(), vi.fn()],
      formatConverterDialog: [h.mockOpenFormatConverter, vi.fn()],
      videoCompressionDialog: [h.mockOpenFormatConverter, vi.fn()],
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
    });

    vi.mocked(toast).mockImplementation(() => 'test-id');

    vi.mocked(openFile).mockResolvedValue({
      data: {} as any,
      error: undefined,
    });

    vi.mocked(moveFileToTrash).mockResolvedValue({
      data: { path: '/media/music/song1.mp3' },
    });

    vi.mocked(getMediaTags).mockResolvedValue({
      tags: {},
      duration: undefined,
      error: undefined,
    });
    vi.mocked(useVideoCaptionerStatus).mockReturnValue({
      isAvailable: true,
      isChecking: false,
    });
    vi.mocked(useFeatures).mockReturnValue({
      isAiFeatureEnabled: true,
      isTranscribeEnabled: true,
      isSubtitleFeaturesEnabled: true,
      isDownloadVideoEnabled: true,
      isFormatConverterEnabled: true,
      isVideoCompressionEnabled: true,
      isVideoCaptionerAsrOptionsEnabled: false,
      setVideoCaptionerAsrOptionsEnabled: vi.fn(),
      isTencentAsrTranscribeEnabled: false,
      setTencentAsrTranscribeEnabled: vi.fn(),
    } as ReturnType<typeof useFeatures>);

    vi.spyOn(Path, 'toPlatformPath').mockImplementation((path: string) => path);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event Handling - Track Open', () => {
    it('should call openFile API when track:open event is received with valid path', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:open', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(openFile).toHaveBeenCalledWith(mockTrack.path);
    });

    it('should show error toast when track:open event has no path', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:open', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: undefined,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(openFile).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('does not have an associated file path')
      );
    });

    it('should show error toast when openFile API fails', async () => {
      const mockError = new Error('Failed to open file');
      vi.mocked(openFile).mockRejectedValue(mockError);

      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:open', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to open file')
      );
    });

    it('should handle successful file open', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:open', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(openFile).toHaveBeenCalledWith(mockTrack.path);
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe('Event Handling - Track Delete', () => {
    it('should open delete confirmation when track:delete event is received', async () => {
      const mockOpenConfirmation = vi.fn();
      vi.mocked(useDialogs).mockReturnValue({
        mediaFilePropertyDialog: [vi.fn(), vi.fn()],
        formatConverterDialog: [vi.fn(), vi.fn()],
        videoCompressionDialog: [vi.fn(), vi.fn()],
        downloadVideoDialog: [vi.fn(), vi.fn()],
        confirmationDialog: [mockOpenConfirmation, vi.fn()],
        spinnerDialog: [vi.fn(), vi.fn()],
        configDialog: [vi.fn(), vi.fn()],
        openFolderDialog: [vi.fn(), vi.fn()],
        filePickerDialog: [vi.fn(), vi.fn()],
        mediaSearchDialog: [vi.fn(), vi.fn()],
        renameFileDialog: [vi.fn(), vi.fn()],
        renameFolderDialog: [vi.fn(), vi.fn()],
        scrapeDialog: [vi.fn(), vi.fn()],
      });

      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:delete', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockSelectedMediaMetadata.files[0],
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);

        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Track',
        }),
      );
      expect(h.mockSaveMediaMetadata).not.toHaveBeenCalled();
    });

    it('should show error toast when track:delete event has no path', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:delete', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: undefined,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('does not have an associated file path')
      );
    });

    it('should show error toast when no media metadata is selected', async () => {
      vi.mocked(useUIMediaFolderStoreState).mockReturnValue({
        folders: [],
        selectedFolder: '',
      });
      vi.mocked(useMediaMetadataQuery).mockReturnValue({
        data: undefined,
        isError: false,
        isPending: false,
        fetchStatus: 'idle' as const,
      } as ReturnType<typeof useMediaMetadataQuery>);

      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:delete', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(toast.error).toHaveBeenCalledWith(
        'No media folder is currently selected.'
      );
    });

    it('should show error toast when file is not found in media metadata', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:delete', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: '/nonexistent/path/song.mp3',
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('is not in the current media folder')
      );
    });

    it('should delete file, update metadata, show success toast, and close dialog on confirm', async () => {
      const mockOpenConfirmation = vi.fn();
      const mockCloseConfirmation = vi.fn();

      vi.mocked(useDialogs).mockReturnValue({
        mediaFilePropertyDialog: [vi.fn(), vi.fn()],
        formatConverterDialog: [vi.fn(), vi.fn()],
        videoCompressionDialog: [vi.fn(), vi.fn()],
        downloadVideoDialog: [vi.fn(), vi.fn()],
        confirmationDialog: [mockOpenConfirmation, mockCloseConfirmation],
        spinnerDialog: [vi.fn(), vi.fn()],
        configDialog: [vi.fn(), vi.fn()],
        openFolderDialog: [vi.fn(), vi.fn()],
        filePickerDialog: [vi.fn(), vi.fn()],
        mediaSearchDialog: [vi.fn(), vi.fn()],
        renameFileDialog: [vi.fn(), vi.fn()],
        renameFolderDialog: [vi.fn(), vi.fn()],
        scrapeDialog: [vi.fn(), vi.fn()],
      });

      vi.spyOn(Path, 'toPlatformPath').mockImplementation((path: string) => path);

      renderHook(() => MusicPanel());

      await act(async () => {
        document.dispatchEvent(
          new CustomEvent('track:delete', {
            bubbles: true,
            composed: true,
            detail: {
              trackId: mockTrack.id,
              timestamp: Date.now(),
              trackPath: mockSelectedMediaMetadata.files[0],
              trackTitle: mockTrack.title,
            },
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Track',
        }),
      );

      const dialogConfig = mockOpenConfirmation.mock.calls[0][0];
      await act(async () => {
        await dialogConfig.content.props.onConfirm();
      });

      expect(moveFileToTrash).toHaveBeenCalledWith(mockSelectedMediaMetadata.files[0]);
      expect(h.mockFetchMediaMetadata).toHaveBeenCalledWith({ path: mockSelectedMediaMetadata.mediaFolderPath });
      expect(h.mockSaveMediaMetadata).toHaveBeenCalledWith({
        pathPosix: mockSelectedMediaMetadata.mediaFolderPath,
        metadata: expect.objectContaining({
          files: [mockSelectedMediaMetadata.files[1]],
        }),
      });
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('song1.mp3'));
      expect(mockCloseConfirmation).toHaveBeenCalled();
    });

    it('should handle multiple file deletions', async () => {
      const multiFileMetadata = {
        ...mockSelectedMediaMetadata,
        files: ['/media/music/song1.mp3', '/media/music/song2.mp3', '/media/music/song3.mp3'],
      };

      h.mockFetchMediaMetadata.mockResolvedValue(multiFileMetadata);
      vi.mocked(useMediaMetadataQuery).mockReturnValue(
        mockQueryOk(multiFileMetadata) as ReturnType<typeof useMediaMetadataQuery>,
      );

      const mockOpenConfirmation = vi.fn();
      vi.mocked(useDialogs).mockReturnValue({
        mediaFilePropertyDialog: [vi.fn(), vi.fn()],
        formatConverterDialog: [vi.fn(), vi.fn()],
        videoCompressionDialog: [vi.fn(), vi.fn()],
        downloadVideoDialog: [vi.fn(), vi.fn()],
        confirmationDialog: [mockOpenConfirmation, vi.fn()],
        spinnerDialog: [vi.fn(), vi.fn()],
        configDialog: [vi.fn(), vi.fn()],
        openFolderDialog: [vi.fn(), vi.fn()],
        filePickerDialog: [vi.fn(), vi.fn()],
        mediaSearchDialog: [vi.fn(), vi.fn()],
        renameFileDialog: [vi.fn(), vi.fn()],
        renameFolderDialog: [vi.fn(), vi.fn()],
        scrapeDialog: [vi.fn(), vi.fn()],
      });

      renderHook(() => MusicPanel());

      await act(async () => {
        document.dispatchEvent(
          new CustomEvent('track:delete', {
            bubbles: true,
            composed: true,
            detail: {
              trackId: mockTrack.id,
              timestamp: Date.now(),
              trackPath: '/media/music/song1.mp3',
              trackTitle: mockTrack.title,
            },
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Track',
        }),
      );

      expect(moveFileToTrash).not.toHaveBeenCalled();
    });

    it('should pass display path to delete confirmation content', async () => {
      const mockOpenConfirmation = vi.fn();

      vi.mocked(useDialogs).mockReturnValue({
        mediaFilePropertyDialog: [vi.fn(), vi.fn()],
        formatConverterDialog: [vi.fn(), vi.fn()],
        videoCompressionDialog: [vi.fn(), vi.fn()],
        downloadVideoDialog: [vi.fn(), vi.fn()],
        confirmationDialog: [mockOpenConfirmation, vi.fn()],
        spinnerDialog: [vi.fn(), vi.fn()],
        configDialog: [vi.fn(), vi.fn()],
        openFolderDialog: [vi.fn(), vi.fn()],
        filePickerDialog: [vi.fn(), vi.fn()],
        mediaSearchDialog: [vi.fn(), vi.fn()],
        renameFileDialog: [vi.fn(), vi.fn()],
        renameFolderDialog: [vi.fn(), vi.fn()],
        scrapeDialog: [vi.fn(), vi.fn()],
      });

      renderHook(() => MusicPanel());

      await act(async () => {
        document.dispatchEvent(
          new CustomEvent('track:delete', {
            bubbles: true,
            composed: true,
            detail: {
              trackId: mockTrack.id,
              timestamp: Date.now(),
              trackPath: mockSelectedMediaMetadata.files[0],
              trackTitle: mockTrack.title,
            },
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const dialogConfig = mockOpenConfirmation.mock.calls[0][0];
      expect(dialogConfig.content.props.displayPath).toBe('song1.mp3');
      expect(typeof dialogConfig.content.props.onConfirm).toBe('function');
    });
  });

  describe('Event Handling - Track Properties', () => {
    it('should open properties dialog when track:properties event is received', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:properties', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const filePropertyDialogMock = vi.mocked(useDialogs).mock.results[0]?.value.mediaFilePropertyDialog[0];
      expect(filePropertyDialogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: expect.any(String),
          track: expect.objectContaining({
            id: expect.any(Number),
            title: expect.any(String),
          }),
        })
      );
    });

    it('should show error toast when track is not found', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:properties', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: 999,
            timestamp: Date.now(),
            trackPath: '/nonexistent/path/song.mp3',
            trackTitle: 'Nonexistent Song',
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('could not be found')
      );
    });

    it('should log success when properties dialog is opened', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:properties', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const filePropertyDialogMock = vi.mocked(useDialogs).mock.results[0]?.value.mediaFilePropertyDialog[0];
      expect(filePropertyDialogMock).toHaveBeenCalled();
    });

    it('should handle errors when opening properties dialog', async () => {
      const mockError = new Error('Failed to open dialog');
      vi.mocked(useDialogs).mockReturnValue({
        mediaFilePropertyDialog: [vi.fn(() => {
          throw mockError;
        }), vi.fn()],
        formatConverterDialog: [vi.fn(), vi.fn()],
        videoCompressionDialog: [vi.fn(), vi.fn()],
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
      });

      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:properties', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to open dialog'),
      );
    });
  });

  describe('Event Listener Management', () => {
    it('should register event listeners on mount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() => MusicPanel());

      expect(addEventListenerSpy).toHaveBeenCalledWith('track:open', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('track:delete', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('track:properties', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('track:formatConvert', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => MusicPanel());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('track:open', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('track:delete', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('track:properties', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('track:formatConvert', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should handle multiple events sequentially', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        const openEvent = new CustomEvent('track:open', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(openEvent);

        const deleteEvent = new CustomEvent('track:delete', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(deleteEvent);

        const propertiesEvent = new CustomEvent('track:properties', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(propertiesEvent);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(openFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully in track open', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(openFile).mockRejectedValue(new Error('Network error'));

      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:open', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not open')
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully in track delete', async () => {
      const mockOpenConfirmation = vi.fn();
      vi.mocked(useDialogs).mockReturnValue({
        mediaFilePropertyDialog: [vi.fn(), vi.fn()],
        formatConverterDialog: [vi.fn(), vi.fn()],
        videoCompressionDialog: [vi.fn(), vi.fn()],
        downloadVideoDialog: [vi.fn(), vi.fn()],
        confirmationDialog: [mockOpenConfirmation, vi.fn()],
        spinnerDialog: [vi.fn(), vi.fn()],
        configDialog: [vi.fn(), vi.fn()],
        openFolderDialog: [vi.fn(), vi.fn()],
        filePickerDialog: [vi.fn(), vi.fn()],
        mediaSearchDialog: [vi.fn(), vi.fn()],
        renameFileDialog: [vi.fn(), vi.fn()],
        renameFolderDialog: [vi.fn(), vi.fn()],
        scrapeDialog: [vi.fn(), vi.fn()],
      });

      vi.mocked(moveFileToTrash).mockRejectedValue(new Error('Move to trash failed'));

      renderHook(() => MusicPanel());

      await act(async () => {
        document.dispatchEvent(
          new CustomEvent('track:delete', {
            bubbles: true,
            composed: true,
            detail: {
              trackId: mockTrack.id,
              timestamp: Date.now(),
              trackPath: mockSelectedMediaMetadata.files[0],
              trackTitle: mockTrack.title,
            },
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Track',
        }),
      );
    });

    it('should handle errors gracefully in track properties', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:properties', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Nested media folder paths', () => {
    const nestedTracks = [
      {
        id: 0,
        title: 'test.mp4',
        artist: '',
        duration: 0,
        thumbnail: undefined,
        addedDate: new Date('2024-01-01'),
        path: NESTED_FILE_PLATFORM,
      },
    ];

    const nestedMediaMetadata = {
      mediaFolderPath: '/path/to/music',
      type: 'music-folder' as const,
      files: [NESTED_FILE_POSIX, '/path/to/music/a/b/c/d/test.srt'],
      status: 'ok' as const,
    };

    beforeEach(() => {
      h.mockOpenFormatConverter.mockReset();
      vi.mocked(convertMusicFilesToTracks).mockReturnValue(nestedTracks);
      vi.mocked(useMediaMetadataQuery).mockReturnValue(
        mockQueryOk(nestedMediaMetadata) as ReturnType<typeof useMediaMetadataQuery>,
      );
      vi.mocked(useDialogs).mockReturnValue({
        mediaFilePropertyDialog: [vi.fn(), vi.fn()],
        formatConverterDialog: [h.mockOpenFormatConverter, vi.fn()],
      videoCompressionDialog: [h.mockOpenFormatConverter, vi.fn()],
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
      });
    });

    it('opens format converter with full nested path on track:formatConvert', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        document.dispatchEvent(
          new CustomEvent('track:formatConvert', {
            bubbles: true,
            composed: true,
            detail: { trackId: 0, timestamp: Date.now() },
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(h.mockOpenFormatConverter).toHaveBeenCalledWith(
        expect.objectContaining({
          path: NESTED_FILE_PLATFORM,
          filePath: NESTED_FILE_PLATFORM,
        }),
      );
      const arg = h.mockOpenFormatConverter.mock.calls[0]![0];
      expect(arg.path).toContain('a/b/c/d');
      expect(arg.path).not.toBe('test.mp4');
    });

    it('opens nested file with platform path on track:open', async () => {
      renderHook(() => MusicPanel());

      await act(async () => {
        document.dispatchEvent(
          new CustomEvent('track:open', {
            bubbles: true,
            composed: true,
            detail: {
              trackId: 0,
              timestamp: Date.now(),
              trackPath: NESTED_FILE_PLATFORM,
              trackTitle: 'test.mp4',
            },
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(openFile).toHaveBeenCalledWith(NESTED_FILE_PLATFORM);
    });
  });
});
