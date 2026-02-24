import { useMediaMetadata } from "@/providers/media-metadata-provider";
import { type UIMediaMetadata } from "@/types/UIMediaMetadata";
import { MediaPlayer, type Track } from "./MediaPlayer";
import { useMemo, useEffect, useRef, useCallback, useState } from "react";
import { convertMusicFilesToTracks, newMusicMediaMetadata } from "@/lib/music";
import { openFile } from "@/api/openFile";
import { deleteFile } from "@/api/deleteFile";
import {
  addMusicEventListener,
  type TrackOpenEventDetail,
  type TrackDeleteEventDetail,
  type TrackPropertiesEventDetail,
  type TrackFormatConvertEventDetail,
  MUSIC_EVENT_NAMES
} from "@/lib/musicEvents";
import { useDialogs } from "@/providers/dialog-provider";
import { toast } from "sonner";
import { Path } from "@core/path";
import { DeleteTrackDialog } from "@/components/dialogs";

interface PendingDelete {
  trackPath: string;
  trackTitle: string;
  currentFiles: string[];
  fileIndex: number;
}

export function MusicPanel() {
  const { selectedMediaMetadata, refreshMediaMetadata, updateMediaMetadata } = useMediaMetadata();
  const { filePropertyDialog, confirmationDialog, downloadVideoDialog, formatConverterDialog } = useDialogs();
  const [openFilePropertyDialog] = filePropertyDialog;
  const [openConfirmation, closeConfirmation] = confirmationDialog;
  const [openDownloadVideo] = downloadVideoDialog;
  const [openFormatConverter] = formatConverterDialog;
  const pendingDeleteRef = useRef<PendingDelete | null>(null);

  // Temporary tracks for downloading/downloaded videos (keyed by URL stored in path)
  const [tmpTracks, setTmpTracks] = useState<Track[]>([]);
  // Counter for generating unique IDs for tmp tracks
  const tmpIdCounterRef = useRef(0);
  // Map to track original positions for maintaining sort order after download
  const positionMapRef = useRef<Map<string, number>>(new Map());

  // Base tracks from media metadata
  const baseTracks = useMemo(() => {
    if(!selectedMediaMetadata) {
      return undefined;
    }
    const musicMediaMetadata = newMusicMediaMetadata(selectedMediaMetadata);
    return convertMusicFilesToTracks(musicMediaMetadata.musicFiles);
  }, [selectedMediaMetadata]);

  // Merge base tracks with tmp tracks and apply position mapping
  const tracks = useMemo(() => {
    const base = baseTracks ?? [];
    let result = [...tmpTracks, ...base] as Track[];

    // Apply position mapping to maintain sort order after download
    if (positionMapRef.current.size > 0) {
      for (const [filePath, targetIndex] of positionMapRef.current) {
        const currentIdx = result.findIndex(t => t.path === filePath);
        if (currentIdx !== -1 && currentIdx !== targetIndex) {
          const [track] = result.splice(currentIdx, 1);
          result.splice(Math.min(targetIndex, result.length), 0, track);
          console.log(`[MusicPanel] Moved track ${filePath} from ${currentIdx} to ${targetIndex}`);
        }
      }
      // Clear position map after applying
      positionMapRef.current.clear();
    }

    return result;
  }, [baseTracks, tmpTracks]);

  // Clean up tmpTracks when they exist in baseTracks (after metadata refresh)
  useEffect(() => {
    if (!baseTracks || tmpTracks.length === 0) return;

    const basePaths = new Set(baseTracks.map(t => t.path));
    const tracksToRemove = tmpTracks.filter(t => basePaths.has(t.path));

    if (tracksToRemove.length > 0) {
      console.log('[MusicPanel] Removing tmpTracks that now exist in baseTracks:', tracksToRemove.map(t => t.path));
      setTmpTracks(prev => prev.filter(t => !basePaths.has(t.path)));
    }
  }, [baseTracks, tmpTracks]);

  const handleTrackOpen = useCallback(async (event: CustomEvent<TrackOpenEventDetail>) => {
    const { trackPath, trackTitle } = event.detail;
    
    try {
      if (!trackPath) {
        toast.error(`Track "${trackTitle}" does not have an associated file path.`);
        return;
      }

      await openFile(Path.toPlatformPath(trackPath));
      console.log('[MusicPanel] Successfully opened file:', trackPath);
    } catch (error) {
      console.error('[MusicPanel] Failed to open file:', error);
      toast.error(`Could not open "${trackTitle}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const pendingDelete = pendingDeleteRef.current;
    if (!pendingDelete) return;

    try {
      await deleteFile(Path.toPlatformPath(pendingDelete.trackPath));
      
      const updatedFiles = [...pendingDelete.currentFiles];
      updatedFiles.splice(pendingDelete.fileIndex, 1);

      const mediaFolderPath = selectedMediaMetadata?.mediaFolderPath;
      if (!mediaFolderPath) {
        toast.error("Media folder path is not available.");
        return;
      }

      updateMediaMetadata(
        mediaFolderPath,
        (current: UIMediaMetadata) => ({
          ...current,
          files: updatedFiles,
        })
      );
      
      toast.success(`"${pendingDelete.trackTitle}" has been deleted.`);
      console.log('[MusicPanel] Successfully deleted track:', pendingDelete.trackTitle);
      pendingDeleteRef.current = null;
      closeConfirmation();
    } catch (error) {
      console.error('[MusicPanel] Failed to delete track:', error);
      toast.error(`Could not delete "${pendingDelete.trackTitle}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [selectedMediaMetadata, updateMediaMetadata, closeConfirmation]);

  const handleDeleteCancel = useCallback(() => {
    pendingDeleteRef.current = null;
    closeConfirmation();
  }, [closeConfirmation]);

  const handleTrackDelete = useCallback(async (event: CustomEvent<TrackDeleteEventDetail>) => {
    const { trackPath, trackTitle } = event.detail;
    
    try {
      if (!trackPath) {
        toast.error(`Track "${trackTitle}" does not have an associated file path.`);
        return;
      }

      if (!selectedMediaMetadata) {
        toast.error("No media folder is currently selected.");
        return;
      }

      const currentFiles = selectedMediaMetadata.files ?? [];
      const fileIndex = currentFiles.findIndex((file) => file === trackPath);

      if (fileIndex === -1) {
        toast.error(`Track "${trackTitle}" is not in the current media folder.`);
        return;
      }

      pendingDeleteRef.current = {
        trackPath,
        trackTitle,
        currentFiles,
        fileIndex
      };

      openConfirmation({
        title: "Delete Track",
        description: `Are you sure you want to delete "${trackTitle}"? This action cannot be undone.`,
        showCloseButton: false,
        content: (
          <DeleteTrackDialog
            trackTitle={trackTitle}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
          />
        ),
      });
    } catch (error) {
      console.error('[MusicPanel] Failed to handle delete track:', error);
      toast.error(`Could not process delete for "${trackTitle}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [selectedMediaMetadata, openConfirmation, handleDeleteConfirm, handleDeleteCancel]);

  const handleTrackProperties = useCallback((event: CustomEvent<TrackPropertiesEventDetail>) => {
    const { trackId, trackTitle } = event.detail;
    
    try {
      const track = tracks?.find((t) => t.id === trackId);
      
      if (!track) {
        toast.error(`Track with ID ${trackId} could not be found.`);
        return;
      }

      openFilePropertyDialog(track);
      console.log('[MusicPanel] Opened properties dialog for track:', trackTitle);
    } catch (error) {
      console.error('[MusicPanel] Failed to open properties dialog:', error);
      toast.error(`Could not open properties for "${trackTitle}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [tracks, openFilePropertyDialog]);

  const handleTrackFormatConvert = useCallback((event: CustomEvent<TrackFormatConvertEventDetail>) => {
    const { trackId } = event.detail;
    const track = tracks?.find((t) => t.id === trackId);
    if (!track) {
      toast.error(`Track with ID ${trackId} could not be found.`);
      return;
    }
    if (!track.path) {
      toast.error("This track has no file path.");
      return;
    }
    openFormatConverter({
      id: track.id,
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      path: track.path,
      filePath: track.path,
    });
  }, [tracks, openFormatConverter]);

  const handleDownloadClick = useCallback(() => {
    // Callback when video data is extracted (may come before or after onStart)
    const handleVideoDataExtracted = (videoData: { title?: string; artist?: string }, url: string) => {
      console.log('[MusicPanel] Extracted video data:', videoData, 'for URL:', url);

      setTmpTracks((prev) => {
        const existingIndex = prev.findIndex((t) => t.path === url);
        if (existingIndex !== -1) {
          // Update existing track
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            title: videoData.title || updated[existingIndex].title,
            artist: videoData.artist || updated[existingIndex].artist,
          };
          return updated;
        }
        // No existing track, create one with URL as title
        const newTrack: Track = {
          id: --tmpIdCounterRef.current,
          title: videoData.title || url,
          artist: videoData.artist || 'Unknown',
          duration: 0,
          thumbnail: '',
          addedDate: new Date(),
          path: url,
          isDownloading: true,
        };
        return [newTrack, ...prev];
      });
    };

    // Callback when download starts
    const handleDownloadStart = (url: string, folder: string) => {
      console.log(`[MusicPanel] Starting download: ${url} to ${folder}`);

      setTmpTracks((prev) => {
        // Check if track already exists (created by onVideoDataExtracted)
        const existingIndex = prev.findIndex((t) => t.path === url);
        if (existingIndex !== -1) {
          // Track exists, just mark as downloading
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            isDownloading: true,
          };
          return updated;
        }
        // Create new track with URL as title
        const newTrack: Track = {
          id: --tmpIdCounterRef.current,
          title: url,
          artist: 'Unknown',
          duration: 0,
          thumbnail: '',
          addedDate: new Date(),
          path: url,
          isDownloading: true,
        };
        return [newTrack, ...prev];
      });
    };

    // Callback when download completes
    const handleDownloadComplete = (url: string, path: string) => {
      console.log(`[MusicPanel] Download complete: ${url} -> ${path}`);

      // Record current position before any changes
      const currentIndex = tracks?.findIndex(t => t.path === url) ?? 0;
      positionMapRef.current.set(path, currentIndex);
      console.log(`[MusicPanel] Recorded position ${currentIndex} for ${path}`);

      // Update tmpTrack with actual file path and mark as not downloading
      setTmpTracks((prev) => {
        const existingIndex = prev.findIndex((t) => t.path === url);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            isDownloading: false,
            path,
          };
          return updated;
        }
        return prev;
      });

      // Refresh media metadata to include the new file
      const mediaFolderPath = selectedMediaMetadata?.mediaFolderPath;
      if (mediaFolderPath) {
        console.log(`[MusicPanel] Refreshing media metadata for ${mediaFolderPath}`);
        refreshMediaMetadata(mediaFolderPath);
      }
    };

    openDownloadVideo(
      handleDownloadStart,
      Path.toPlatformPath(selectedMediaMetadata!.mediaFolderPath!),
      handleVideoDataExtracted,
      handleDownloadComplete
    );
  }, [openDownloadVideo, selectedMediaMetadata]);

  useEffect(() => {
    const unsubscribeOpen = addMusicEventListener<TrackOpenEventDetail>(
      MUSIC_EVENT_NAMES['track:open'],
      handleTrackOpen
    );

    const unsubscribeDelete = addMusicEventListener<TrackDeleteEventDetail>(
      MUSIC_EVENT_NAMES['track:delete'],
      handleTrackDelete
    );

    const unsubscribeProperties = addMusicEventListener<TrackPropertiesEventDetail>(
      MUSIC_EVENT_NAMES['track:properties'],
      handleTrackProperties
    );

    const unsubscribeFormatConvert = addMusicEventListener<TrackFormatConvertEventDetail>(
      MUSIC_EVENT_NAMES['track:formatConvert'],
      handleTrackFormatConvert
    );

    return () => {
      unsubscribeOpen();
      unsubscribeDelete();
      unsubscribeProperties();
      unsubscribeFormatConvert();
    };
  }, [handleTrackOpen, handleTrackDelete, handleTrackProperties, handleTrackFormatConvert]);

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <MediaPlayer tracks={tracks} onDownloadClick={handleDownloadClick} />
    </div>
  );
}
