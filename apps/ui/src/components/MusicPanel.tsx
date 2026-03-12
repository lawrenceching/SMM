import { useMediaMetadataStoreState } from "@/stores/mediaMetadataStore";
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions";
import { type UIMediaMetadata } from "@/types/UIMediaMetadata";
import { MusicFileTable, type MusicFileRow } from "./MusicFileTable";
import { MusicHeaderV2 } from "./MusicHeaderV2";
import { MediaPanelInitializingHint } from "./MediaPanelInitializingHint";
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { convertMusicFilesToTracks, newMusicMediaMetadata } from "@/lib/music";
import { openFile } from "@/api/openFile";
import { deleteFile } from "@/api/deleteFile";
import { getMediaTags } from "@/api/ffmpeg";
import {
  addMusicEventListener,
  type TrackOpenEventDetail,
  type TrackDeleteEventDetail,
  type TrackPropertiesEventDetail,
  type TrackFormatConvertEventDetail,
  type TrackEditTagsEventDetail,
  MUSIC_EVENT_NAMES
} from "@/lib/musicEvents";
import { useDialogs } from "@/providers/dialog-provider";
import { toast } from "sonner";
import { Path } from "@core/path";
import { DeleteTrackDialog } from "@/components/dialogs";
import type { Track } from "./MediaPlayer";

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
  const { selectedMediaMetadata } = useMediaMetadataStoreState();
  const { refreshMediaMetadata, updateMediaMetadata } = useMediaMetadataActions();
  const { filePropertyDialog, confirmationDialog, downloadVideoDialog, formatConverterDialog, editMediaFileDialog } = useDialogs();
  const [openFilePropertyDialog] = filePropertyDialog;
  const [openConfirmation, closeConfirmation] = confirmationDialog;
  const [openDownloadVideo] = downloadVideoDialog;
  const [openFormatConverter] = formatConverterDialog;
  const [openEditMediaFile] = editMediaFileDialog;
  const pendingDeleteRef = useRef<PendingDelete | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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

  }, [selectedMediaMetadata]);

  // When panel opens, sequentially read artist, title, and duration from each file (ffprobe) and update tracks
  const pathSignature = useMemo(
    () =>
      tracks
        .filter((t) => t.path)
        .map((t) => t.path)
        .sort()
        .join("\n"),
    [tracks]
  );
  const tagFetchAbortedRef = useRef(false);
  useEffect(() => {
    if (!selectedMediaMetadata || pathSignature === "") return;

    tagFetchAbortedRef.current = false;
    const tracksToFetch = tracks.filter((t) => t.path);

    (async () => {
      for (const track of tracksToFetch) {
        if (tagFetchAbortedRef.current) break;
        try {
          const res = await getMediaTags({ path: track.path! });
          if (tagFetchAbortedRef.current) break;
          if (res.error) {
            console.warn("[MusicPanel] Failed to read tags for", track.path, res.error);
            continue;
          }
          const artist = res.tags?.artist ?? res.tags?.ARTIST ?? "";
          const title = res.tags?.title ?? res.tags?.TITLE ?? "";
          const duration =
            res.duration != null && Number.isFinite(res.duration)
              ? Math.round(res.duration)
              : undefined;
          setTracks((prev) =>
            prev.map((t) =>
              t.path === track.path
                ? {
                    ...t,
                    artist,
                    ...(title !== "" && { title }),
                    ...(duration !== undefined && { duration }),
                  }
                : t
            )
          );
        } catch (err) {
          console.warn("[MusicPanel] Error reading tags for", track.path, err);
        }
      }
    })();

    return () => {
      tagFetchAbortedRef.current = true;
    };
    // Intentionally depend on pathSignature (path list) only; re-running when `tracks` changes would refetch on every row update
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathSignature encodes the set of paths to fetch
  }, [selectedMediaMetadata, pathSignature]);

  // Build table data from tracks
  const tableData = useMemo<MusicFileRow[]>(() => {
    return tracks.map((track, index) => ({
      id: track.id,
      index,
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      thumbnail: track.thumbnail,
      path: track.path,
      status: track.status,
    }));
  }, [tracks]);

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

  const handleTrackEditTags = useCallback((event: CustomEvent<TrackEditTagsEventDetail>) => {
    const { trackPath } = event.detail;
    if (!trackPath) return;
    openEditMediaFile({ path: trackPath });
  }, [openEditMediaFile]);

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

  // Handle track click for playback indication
  const handleTrackClick = useCallback((trackId: number) => {
    const track = tracks.find(t => t.id === trackId)
    if (!track || track.status === 'downloading') return

    if (currentTrackId === trackId) {
      setIsPlaying(prev => !prev)
    } else {
      setCurrentTrackId(trackId)
      setIsPlaying(true)
    }
  }, [tracks, currentTrackId])

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

    const unsubscribeEditTags = addMusicEventListener<TrackEditTagsEventDetail>(
      MUSIC_EVENT_NAMES['track:editTags'],
      handleTrackEditTags
    );

    return () => {
      unsubscribeOpen();
      unsubscribeDelete();
      unsubscribeProperties();
      unsubscribeFormatConvert();
      unsubscribeEditTags();
    };
  }, [handleTrackOpen, handleTrackDelete, handleTrackProperties, handleTrackFormatConvert, handleTrackEditTags]);

  return (
    <div className='w-full h-full min-h-0 relative flex flex-col'>
      <div className="shrink-0 px-4 pt-4">
        <MusicHeaderV2
          selectedMediaMetadata={selectedMediaMetadata}
          onDownloadClick={handleDownloadClick}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {selectedMediaMetadata?.status === "initializing" ? (
          <MediaPanelInitializingHint />
        ) : (
          <MusicFileTable
            key={selectedMediaMetadata?.mediaFolderPath ?? "no-folder"}
            data={tableData}
            mediaFolderPath={selectedMediaMetadata?.mediaFolderPath}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            onTrackClick={handleTrackClick}
          />
        )}
      </div>
    </div>
  );
}
