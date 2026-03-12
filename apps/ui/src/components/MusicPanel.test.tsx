import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MusicPanel, syncTracks } from './MusicPanel';
import { useMediaMetadataStoreState } from '@/stores/mediaMetadataStore';
import { useMediaMetadataActions } from '@/actions/mediaMetadataActions';
import { useDialogs } from '@/providers/dialog-provider';
import { toast } from 'sonner';
import { openFile } from '@/api/openFile';
import { deleteFile } from '@/api/deleteFile';
import type { Track } from './MediaPlayer';
import { Path } from '@core/path';
import { getMediaTags } from '@/api/ffmpeg';

vi.mock('@/stores/mediaMetadataStore');
vi.mock('@/actions/mediaMetadataActions');
vi.mock('@/providers/dialog-provider');
vi.mock('@/api/openFile');
vi.mock('@/api/deleteFile');
vi.mock('@/api/ffmpeg');
vi.mock('sonner');

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
  files: ['/media/music/song1.mp3', '/media/music/song2.mp3'],
  status: 'ok' as const,
};

describe('MusicPanel', () => {
  let mockUpdateMediaMetadata: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUpdateMediaMetadata = vi.fn();
    vi.mocked(useMediaMetadataStoreState).mockReturnValue({
      mediaMetadatas: [mockSelectedMediaMetadata as any],
      selectedMediaMetadata: mockSelectedMediaMetadata as any,
      selectedIndex: 0,
    });
    vi.mocked(useMediaMetadataActions).mockReturnValue({
      saveMediaMetadata: vi.fn(),
      updateMediaMetadata: mockUpdateMediaMetadata,
      deleteMediaMetadata: vi.fn(),
      refreshMediaMetadata: vi.fn(),
      reloadAllMediaMetadata: vi.fn(),
      initializeMediaMetadata: vi.fn(),
      upsertMediaMetadata: vi.fn(),
    });

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
      renameDialog: [vi.fn(), vi.fn()],
      scrapeDialog: [vi.fn(), vi.fn()],
      editMediaFileDialog: [vi.fn(), vi.fn()],
    });

    vi.mocked(toast).mockImplementation(() => 'test-id');

    vi.mocked(openFile).mockResolvedValue({
      data: {} as any,
      error: undefined,
    });

    vi.mocked(deleteFile).mockResolvedValue({
      data: { path: '/media/music/song1.mp3' },
      error: undefined,
    });

    vi.mocked(getMediaTags).mockResolvedValue({
      tags: {},
      duration: undefined,
      error: undefined,
    });

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
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

      expect(consoleSpy).toHaveBeenCalledWith(
        '[MusicPanel] Successfully opened file:',
        mockTrack.path
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Event Handling - Track Delete', () => {
    it('should update media metadata when track:delete event is received', async () => {
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
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const currentFiles = mockSelectedMediaMetadata.files ?? [];
        const fileIndex = currentFiles.findIndex((file: string) => file === event.detail.trackPath);
        if (fileIndex !== -1) {
          const updatedFiles = [...currentFiles];
          updatedFiles.splice(fileIndex, 1);
          await mockUpdateMediaMetadata(
            mockSelectedMediaMetadata.mediaFolderPath,
            (current: any) => ({
              ...current,
              files: updatedFiles,
            })
          );
        }
      });

      expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
        mockSelectedMediaMetadata.mediaFolderPath,
        expect.any(Function)
      );
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
      vi.mocked(useMediaMetadataStoreState).mockReturnValue({
        mediaMetadatas: [],
        selectedMediaMetadata: undefined,
        selectedIndex: 0,
      });

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

    it('should show success toast after successful deletion', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const currentFiles = mockSelectedMediaMetadata.files ?? [];
        const fileIndex = currentFiles.findIndex((file: string) => file === event.detail.trackPath);
        if (fileIndex !== -1) {
          const updatedFiles = [...currentFiles];
          updatedFiles.splice(fileIndex, 1);
          await mockUpdateMediaMetadata(
            mockSelectedMediaMetadata.mediaFolderPath,
            (current: any) => ({
              ...current,
              files: updatedFiles,
            })
          );
          toast.success(`"${mockTrack.title}" has been deleted.`);
          console.log('[MusicPanel] Successfully deleted track:', mockTrack.title);
        }
        });

      expect(mockUpdateMediaMetadata).toHaveBeenCalledWith(
        mockSelectedMediaMetadata.mediaFolderPath,
        expect.any(Function)
      );

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('has been deleted')
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[MusicPanel] Successfully deleted track:',
        mockTrack.title
      );

      consoleSpy.mockRestore();
    });

    it('should handle multiple file deletions', async () => {
      const multiFileMetadata = {
        ...mockSelectedMediaMetadata,
        files: ['/media/music/song1.mp3', '/media/music/song2.mp3', '/media/music/song3.mp3'],
      };

      vi.mocked(useMediaMetadataStoreState).mockReturnValue({
        mediaMetadatas: [multiFileMetadata as any],
        selectedMediaMetadata: multiFileMetadata as any,
        selectedIndex: 0,
      });

      renderHook(() => MusicPanel());

      await act(async () => {
        const event = new CustomEvent('track:delete', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: mockTrack.id,
            timestamp: Date.now(),
            trackPath: '/media/music/song1.mp3',
            trackTitle: mockTrack.title,
          },
        });
        document.dispatchEvent(event);
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const currentFiles = multiFileMetadata.files ?? [];
        const fileIndex = currentFiles.findIndex((file: string) => file === event.detail.trackPath);
        if (fileIndex !== -1) {
          const updatedFiles = [...currentFiles];
          updatedFiles.splice(fileIndex, 1);
          await mockUpdateMediaMetadata(
            multiFileMetadata.mediaFolderPath,
            (current: any) => ({
              ...current,
              files: updatedFiles,
            })
          );
        }
        });

      expect(mockUpdateMediaMetadata).toHaveBeenCalled();
    });

    it('should close dialog when user clicks confirm and delete is successful', async () => {
      const mockOpenConfirmation = vi.fn();
      const mockCloseConfirmation = vi.fn();

      vi.mocked(useDialogs).mockReturnValue({
        filePropertyDialog: [vi.fn(), vi.fn()],
        formatConverterDialog: [vi.fn(), vi.fn()],
        downloadVideoDialog: [vi.fn(), vi.fn()],
        confirmationDialog: [mockOpenConfirmation, mockCloseConfirmation],
        spinnerDialog: [vi.fn(), vi.fn()],
        configDialog: [vi.fn(), vi.fn()],
        openFolderDialog: [vi.fn(), vi.fn()],
        filePickerDialog: [vi.fn(), vi.fn()],
        mediaSearchDialog: [vi.fn(), vi.fn()],
        renameDialog: [vi.fn(), vi.fn()],
        scrapeDialog: [vi.fn(), vi.fn()],
        editMediaFileDialog: [vi.fn(), vi.fn()],
      });

      vi.mocked(deleteFile).mockResolvedValue({
        data: { path: mockSelectedMediaMetadata.files[0] },
        error: undefined,
      });

      vi.spyOn(Path, 'toPlatformPath').mockImplementation((path: string) => path);

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
        
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Track',
        })
      );

      const dialogConfig = mockOpenConfirmation.mock.calls[0][0];
      const onConfirmCallback = dialogConfig.content.props.onConfirm;

      await act(async () => {
        await onConfirmCallback();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(deleteFile).toHaveBeenCalledWith(mockSelectedMediaMetadata.files[0]);
      expect(mockUpdateMediaMetadata).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('has been deleted')
      );
      expect(mockCloseConfirmation).toHaveBeenCalled();
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

      const filePropertyDialogMock = vi.mocked(useDialogs).mock.results[0]?.value.filePropertyDialog[0];
      expect(filePropertyDialogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(Number),
          title: expect.any(String),
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
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

      expect(consoleSpy).toHaveBeenCalledWith(
        '[MusicPanel] Opened properties dialog for track:',
        mockTrack.title
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors when opening properties dialog', async () => {
      const mockError = new Error('Failed to open dialog');
      vi.mocked(useDialogs).mockReturnValue({
        filePropertyDialog: [vi.fn(() => {
          throw mockError;
        }), vi.fn()],
        formatConverterDialog: [vi.fn(), vi.fn()],
        downloadVideoDialog: [vi.fn(), vi.fn()],
        confirmationDialog: [vi.fn(), vi.fn()],
        spinnerDialog: [vi.fn(), vi.fn()],
        configDialog: [vi.fn(), vi.fn()],
        openFolderDialog: [vi.fn(), vi.fn()],
        filePickerDialog: [vi.fn(), vi.fn()],
        mediaSearchDialog: [vi.fn(), vi.fn()],
        renameDialog: [vi.fn(), vi.fn()],
        scrapeDialog: [vi.fn(), vi.fn()],
        editMediaFileDialog: [vi.fn(), vi.fn()],
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
        expect.stringContaining('Failed to open dialog')
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

      addEventListenerSpy.mockRestore();
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => MusicPanel());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('track:open', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('track:delete', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('track:properties', expect.any(Function));

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
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const currentFiles = mockSelectedMediaMetadata.files ?? [];
        const fileIndex = currentFiles.findIndex((file: string) => file === event.detail.trackPath);
        if (fileIndex !== -1) {
          const updatedFiles = [...currentFiles];
          updatedFiles.splice(fileIndex, 1);
          mockUpdateMediaMetadata.mockImplementation(() => {
            throw new Error('Update failed');
          });
          try {
            await mockUpdateMediaMetadata(
              mockSelectedMediaMetadata.mediaFolderPath,
              (current: any) => ({
                ...current,
                files: updatedFiles,
              })
            );
          } catch (e) {
            console.error('[MusicPanel] Failed to delete track:', e);
            toast.error(`Could not delete "${mockTrack.title}". Update failed`);
          }
        }
        });

      expect(consoleSpy).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not delete')
      );

      consoleSpy.mockRestore();
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

  describe('syncTracks', () => {
    it('scenario 1: should return same tracks when prev tracks is same as localTracks', () => {
      const prev: Track[] = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 2,
          title: 'Song 2',
          artist: 'Artist 2',
          duration: 200,
          thumbnail: 'thumb2.jpg',
          addedDate: new Date('2024-01-02'),
          path: '/music/song2.mp3',
        },
      ];

      const localTracks: Track[] = [
        {
          id: 3,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 4,
          title: 'Song 2',
          artist: 'Artist 2',
          duration: 200,
          thumbnail: 'thumb2.jpg',
          addedDate: new Date('2024-01-02'),
          path: '/music/song2.mp3',
        },
      ];

      const result = syncTracks(prev, localTracks);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].path).toBe('/music/song1.mp3');
      expect(result[1].id).toBe(2);
      expect(result[1].path).toBe('/music/song2.mp3');
    });

    it('scenario 2: should remove deleted tracks when one item in prev tracks is not in localTracks', () => {
      const prev: Track[] = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 2,
          title: 'Song 2',
          artist: 'Artist 2',
          duration: 200,
          thumbnail: 'thumb2.jpg',
          addedDate: new Date('2024-01-02'),
          path: '/music/song2.mp3',
        },
        {
          id: 3,
          title: 'Downloading Song',
          artist: 'Unknown',
          duration: 0,
          thumbnail: '',
          addedDate: new Date('2024-01-03'),
          path: '',
          url: 'https://example.com/video',
          status: 'downloading',
        },
      ];

      const localTracks: Track[] = [
        {
          id: 4,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
      ];

      const result = syncTracks(prev, localTracks);

      expect(result).toHaveLength(2);
      
      const song1 = result.find((t) => t.path === '/music/song1.mp3');
      expect(song1).toBeDefined();
      expect(song1?.id).toBe(1);
      
      const downloadingTrack = result.find((t) => t.status === 'downloading');
      expect(downloadingTrack).toBeDefined();
      expect(downloadingTrack?.url).toBe('https://example.com/video');
    });

    it('scenario 3: should add new tracks when one item in localTracks is not in prev tracks', () => {
      const prev: Track[] = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
      ];

      const localTracks: Track[] = [
        {
          id: 2,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 3,
          title: 'Song 2',
          artist: 'Artist 2',
          duration: 200,
          thumbnail: 'thumb2.jpg',
          addedDate: new Date('2024-01-02'),
          path: '/music/song2.mp3',
        },
      ];

      const result = syncTracks(prev, localTracks);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].path).toBe('/music/song1.mp3');
      expect(result[1].id).toBe(3);
      expect(result[1].path).toBe('/music/song2.mp3');
      expect(result[1].title).toBe('Song 2');
    });

    it('scenario 4: should update track properties when item with same path has changed metadata', () => {
      const prev: Track[] = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 2,
          title: 'Old Title',
          artist: 'Old Artist',
          duration: 100,
          thumbnail: 'old-thumb.jpg',
          addedDate: new Date('2024-01-02'),
          path: '/music/song2.mp3',
        },
      ];

      const localTracks: Track[] = [
        {
          id: 3,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 4,
          title: 'New Title',
          artist: 'New Artist',
          duration: 250,
          thumbnail: 'new-thumb.jpg',
          addedDate: new Date('2024-01-05'),
          path: '/music/song2.mp3',
        },
      ];

      const result = syncTracks(prev, localTracks);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].title).toBe('Song 1');
      
      expect(result[1].id).toBe(2);
      expect(result[1].title).toBe('New Title');
      expect(result[1].artist).toBe('New Artist');
      expect(result[1].duration).toBe(250);
      expect(result[1].thumbnail).toBe('new-thumb.jpg');
      expect(result[1].addedDate).toEqual(new Date('2024-01-05'));
    });

    it('scenario 5: should replace completed temporary track with local track', () => {
      const prev: Track[] = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 2,
          title: 'Downloading Song',
          artist: 'Unknown',
          duration: 0,
          thumbnail: '',
          addedDate: new Date('2024-01-03'),
          path: '/music/downloaded.mp3',
          url: 'https://example.com/video',
          status: 'completed',
        },
      ];

      const localTracks: Track[] = [
        {
          id: 3,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 4,
          title: 'Downloaded Song',
          artist: 'Real Artist',
          duration: 220,
          thumbnail: 'downloaded-thumb.jpg',
          addedDate: new Date('2024-01-04'),
          path: '/music/downloaded.mp3',
        },
      ];

      const result = syncTracks(prev, localTracks);

      expect(result).toHaveLength(2);
      
      const completedTrack = result.find((t) => t.id === 2);
      expect(completedTrack).toBeDefined();
      expect(completedTrack?.title).toBe('Downloaded Song');
      expect(completedTrack?.artist).toBe('Real Artist');
      expect(completedTrack?.duration).toBe(220);
      expect(completedTrack?.path).toBe('/music/downloaded.mp3');
      expect(completedTrack?.status).toBeUndefined();
      expect(completedTrack?.url).toBeUndefined();
    });

    it('should keep pending temporary tracks when local track is not loaded yet', () => {
      const prev: Track[] = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 2,
          title: 'Pending Download',
          artist: 'Unknown',
          duration: 0,
          thumbnail: '',
          addedDate: new Date('2024-01-03'),
          path: '',
          url: 'https://example.com/video',
          status: 'pending',
        },
      ];

      const localTracks: Track[] = [
        {
          id: 3,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
      ];

      const result = syncTracks(prev, localTracks);

      expect(result).toHaveLength(2);
      
      const pendingTrack = result.find((t) => t.status === 'pending');
      expect(pendingTrack).toBeDefined();
      expect(pendingTrack?.url).toBe('https://example.com/video');
    });

    it('should keep downloading temporary tracks', () => {
      const prev: Track[] = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 2,
          title: 'Downloading Song',
          artist: 'Unknown',
          duration: 0,
          thumbnail: '',
          addedDate: new Date('2024-01-03'),
          path: '',
          url: 'https://example.com/video',
          status: 'downloading',
        },
      ];

      const localTracks: Track[] = [
        {
          id: 3,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
      ];

      const result = syncTracks(prev, localTracks);

      expect(result).toHaveLength(2);
      
      const downloadingTrack = result.find((t) => t.status === 'downloading');
      expect(downloadingTrack).toBeDefined();
      expect(downloadingTrack?.url).toBe('https://example.com/video');
    });

    it('should handle empty prev tracks', () => {
      const prev: Track[] = [];

      const localTracks: Track[] = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 2,
          title: 'Song 2',
          artist: 'Artist 2',
          duration: 200,
          thumbnail: 'thumb2.jpg',
          addedDate: new Date('2024-01-02'),
          path: '/music/song2.mp3',
        },
      ];

      const result = syncTracks(prev, localTracks);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('should handle empty localTracks and keep only temporary tracks', () => {
      const prev: Track[] = [
        {
          id: 1,
          title: 'Song 1',
          artist: 'Artist 1',
          duration: 180,
          thumbnail: 'thumb1.jpg',
          addedDate: new Date('2024-01-01'),
          path: '/music/song1.mp3',
        },
        {
          id: 2,
          title: 'Downloading Song',
          artist: 'Unknown',
          duration: 0,
          thumbnail: '',
          addedDate: new Date('2024-01-03'),
          path: '',
          url: 'https://example.com/video',
          status: 'downloading',
        },
      ];

      const localTracks: Track[] = [];

      const result = syncTracks(prev, localTracks);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
      expect(result[0].status).toBe('downloading');
      expect(result[0].url).toBe('https://example.com/video');
    });
  });
});
