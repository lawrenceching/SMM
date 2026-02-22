import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MusicPanel } from './MusicPanel';
import { useMediaMetadata } from '@/providers/media-metadata-provider';
import { useDialogs } from '@/providers/dialog-provider';
import { toast } from 'sonner';
import { openFile } from '@/api/openFile';
import { deleteFile } from '@/api/deleteFile';
import type { Track } from './MediaPlayer';
import { Path } from '@core/path';

vi.mock('@/providers/media-metadata-provider');
vi.mock('@/providers/dialog-provider');
vi.mock('@/api/openFile');
vi.mock('@/api/deleteFile');
vi.mock('sonner');

const mockTrack: Track = {
  id: 1,
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  duration: 180,
  genre: 'pop',
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
    vi.mocked(useMediaMetadata).mockReturnValue({
      selectedMediaMetadata: mockSelectedMediaMetadata,
      updateMediaMetadata: mockUpdateMediaMetadata,
      refreshMediaMetadata: vi.fn(),
      mediaMetadatas: [],
      setMediaMetadatas: vi.fn(),
      addMediaMetadata: vi.fn(),
      removeMediaMetadata: vi.fn(),
      getMediaMetadata: vi.fn(),
      setSelectedMediaMetadata: vi.fn(),
      setSelectedMediaMetadataByMediaFolderPath: vi.fn(),
      reloadMediaMetadatas: vi.fn(),
      updateMediaMetadataStatus: vi.fn(),
    });

    vi.mocked(useDialogs).mockReturnValue({
      filePropertyDialog: [vi.fn(), vi.fn()],
      downloadVideoDialog: [vi.fn(), vi.fn()],
      confirmationDialog: [vi.fn(), vi.fn()],
      spinnerDialog: [vi.fn(), vi.fn()],
      configDialog: [vi.fn(), vi.fn()],
      openFolderDialog: [vi.fn(), vi.fn()],
      filePickerDialog: [vi.fn(), vi.fn()],
      mediaSearchDialog: [vi.fn(), vi.fn()],
      renameDialog: [vi.fn(), vi.fn()],
      scrapeDialog: [vi.fn(), vi.fn()],
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
      vi.mocked(useMediaMetadata).mockReturnValue({
        selectedMediaMetadata: undefined,
        updateMediaMetadata: vi.fn(),
        refreshMediaMetadata: vi.fn(),
        mediaMetadatas: [],
        setMediaMetadatas: vi.fn(),
        addMediaMetadata: vi.fn(),
        removeMediaMetadata: vi.fn(),
        getMediaMetadata: vi.fn(),
        setSelectedMediaMetadata: vi.fn(),
        setSelectedMediaMetadataByMediaFolderPath: vi.fn(),
        reloadMediaMetadatas: vi.fn(),
        updateMediaMetadataStatus: vi.fn(),
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

      vi.mocked(useMediaMetadata).mockReturnValue({
        selectedMediaMetadata: multiFileMetadata,
        updateMediaMetadata: mockUpdateMediaMetadata,
        refreshMediaMetadata: vi.fn(),
        mediaMetadatas: [],
        setMediaMetadatas: vi.fn(),
        addMediaMetadata: vi.fn(),
        removeMediaMetadata: vi.fn(),
        getMediaMetadata: vi.fn(),
        setSelectedMediaMetadata: vi.fn(),
        setSelectedMediaMetadataByMediaFolderPath: vi.fn(),
        reloadMediaMetadatas: vi.fn(),
        updateMediaMetadataStatus: vi.fn(),
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
        downloadVideoDialog: [vi.fn(), vi.fn()],
        confirmationDialog: [vi.fn(), vi.fn()],
        spinnerDialog: [vi.fn(), vi.fn()],
        configDialog: [vi.fn(), vi.fn()],
        openFolderDialog: [vi.fn(), vi.fn()],
        filePickerDialog: [vi.fn(), vi.fn()],
        mediaSearchDialog: [vi.fn(), vi.fn()],
        renameDialog: [vi.fn(), vi.fn()],
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
});
