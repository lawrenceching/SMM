import { useMediaMetadata } from "@/providers/media-metadata-provider";
import { type UIMediaMetadata } from "@/types/UIMediaMetadata";
import { MediaPlayer, type Track } from "./MediaPlayer";
import { useEffect, useRef, useCallback, useState } from "react";
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

/**
 * 
 * @param prev The track in current state
 * @param localTracks The track from latest local files
 * @returns 
 */
export function syncTracks(prev: Track[], localTracks: Track[]) {
  let tracks = prev;

  let prevPermanentTracks = tracks.filter((track) => track.status === undefined);
  // tracks may be deleted from local folder
  const deletedTracks = prevPermanentTracks.filter((prevTrack) => !localTracks.some((newTrack) => newTrack.path === prevTrack.path));
  tracks = tracks.filter((track) => track.status !== undefined || !deletedTracks.some((deletedTrack) => deletedTrack.path === track.path));

  // tracks may be updated in local folder
  tracks = tracks.map((track) => {
    if(track.status !== undefined) {
      // temporary track
      return track;
    }

    const updatedTrack = localTracks.find((updatedTrack) => updatedTrack.path === track.path);
    return !!updatedTrack ? {
      ...updatedTrack,
      id: track.id,
    } : track;
  });

  // new tracks may be added to local folder
  const newTracks = localTracks.filter((newTrack) => !prev.some((prevTrack) => prevTrack.path === newTrack.path));
  tracks = [...tracks, ...newTracks];
  
  // Remove temporary tracks that have successfully downloaded
  tracks = tracks.map((track) => {
    if(track.status === undefined) {
      return track;
    }

    // if status is completed and if the local track is loaded
    // Replace the temporary track with the loaded track
    if(track.status === "completed") {

      const localTrack = localTracks.find((localTrack) => localTrack.path === track.path)
      if(localTrack) {
        return {
          ...localTrack,
          id: track.id,
          status: undefined,
          url: undefined,
        };
      }
    }
    
    return track;
  });

  return tracks;
}

export function MusicPanel() {
  const { selectedMediaMetadata, refreshMediaMetadata, updateMediaMetadata } = useMediaMetadata();
  const { filePropertyDialog, confirmationDialog, downloadVideoDialog, formatConverterDialog } = useDialogs();
  const [openFilePropertyDialog] = filePropertyDialog;
  const [openConfirmation, closeConfirmation] = confirmationDialog;
  const [openDownloadVideo] = downloadVideoDialog;
  const [openFormatConverter] = formatConverterDialog;
  const pendingDeleteRef = useRef<PendingDelete | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {

    if(!selectedMediaMetadata) {
      // clean up permanent tracks, and keep the temporary tracks
      setTracks((prev) => prev.filter((track) => track.path === undefined ));
      return;
    }

    const musicMediaMetadata = newMusicMediaMetadata(selectedMediaMetadata);
    const newTracks = convertMusicFilesToTracks(musicMediaMetadata.musicFiles);

    setTracks(prev => {
      return syncTracks(prev, newTracks);
    });

  }, [selectedMediaMetadata])

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

      setTracks(prev => {

        // The VideoDataExtracted event and DownloadStarted event may 
        // arrive out of order, so we need to check if the track already exists
        if(prev.some((t) => t.url === url)) {
          // if track already exists, update it

          return prev.map(prev => {
            if(prev.url === url) {
              return {
                ...prev,
                title: videoData.title || prev.title,
                artist: videoData.artist || prev.artist,
              }
            }
            return prev;
          })

        } else {

          // if track does not exist, create it
          return [...prev, {
            id: Date.now(),
            title: videoData.title || url,
            artist: videoData.artist || 'Unknown',
            duration: 0,
            thumbnail: '',
            addedDate: new Date(),
            path: '',
            url,
            status: "pending",
          }]
        }

      })

    };

    // Callback when download starts
    const handleDownloadStart = (url: string, folder: string) => {
      console.log(`[MusicPanel] Starting download: ${url} to ${folder}`);

      setTracks(prev => {

        // The VideoDataExtracted event and DownloadStarted event may 
        // arrive out of order, so we need to check if the track already exists
        if(prev.some((t) => t.url === url)) {
          // if track already exists, update it

          return prev.map(prev => {
            if(prev.url === url) {
              return {
                ...prev,
                url: url,
                status: "downloading",
              }
            }
            return prev;
          })

        } else {

          // if track does not exist, create it
          return [...prev, {
            id: Date.now(),
            title: url,
            artist: '',
            duration: 0,
            thumbnail: '',
            addedDate: new Date(),
            path: '',
            url,
            status: "downloading",
          }]
        }

      })
      
    };

    // Callback when download completes
    const handleDownloadComplete = (url: string, path: string) => {
      console.log(`[MusicPanel] Download complete: ${url} -> ${path}`);

      setTracks(prev => {
        return prev.map(prev => {
          if(prev.url === url) {
            return {
              ...prev,
              path: path,
              status: "completed",
            }
          }
          return prev;
        })
      })

      // Refresh media metadata to include the new file
      const mediaFolderPath = selectedMediaMetadata?.mediaFolderPath;
      if (mediaFolderPath) {
        console.log(`[MusicPanel] Refreshing media metadata for ${mediaFolderPath}`);
        // in useEffect of selectedMediaMetadata, the permanent track will replace the tmp track
        // so we only need to refresh the media metadata here.
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
