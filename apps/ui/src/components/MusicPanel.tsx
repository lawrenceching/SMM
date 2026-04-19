import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore";
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata";
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation";
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation";
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys";
import type { MediaMetadata } from "@core/types";
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder";
import { MusicFileTable, type MusicFileRow } from "./MusicFileTable";
import { MusicHeaderV2 } from "./MusicHeaderV2";
import { MediaPanelInitializingHint } from "./MediaPanelInitializingHint";
import { useEffect, useCallback, useState, useMemo } from "react";
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
  MUSIC_EVENT_NAMES,
} from "@/lib/musicEvents";
import { useDialogs } from "@/providers/dialog-provider";
import { toast } from "sonner";
import { Path } from "@core/path";
import { mergeLibraryTracksWithJobTracks, tracksFromDownloadJobRecords } from "@/lib/tracksFromDownloadVideoJobs";
import { DeleteTrackDialog } from "@/components/dialogs";
import type { Track } from "./MediaPlayer";
import { useDownloadManager } from "@/hooks/useDownloadManager";

interface PendingDelete {
  trackPath: string;
  trackTitle: string;
  currentFiles: string[];
  fileIndex: number;
}

export function syncTracks(prev: Track[], localTracks: Track[]) {
  let tracks = prev;

  const prevPermanentTracks = tracks.filter((track) => track.status === undefined);
  const deletedTracks = prevPermanentTracks.filter(
    (prevTrack) => !localTracks.some((newTrack) => newTrack.path === prevTrack.path),
  );
  tracks = tracks.filter(
    (track) => track.status !== undefined || !deletedTracks.some((dt) => dt.path === track.path),
  );

  tracks = tracks.map((track) => {
    if (track.status !== undefined) {
      return track;
    }

    const localMatch = localTracks.find((lt) => lt.path === track.path);
    return localMatch ? { ...localMatch, id: track.id } : track;
  });

  const newTracks = localTracks.filter(
    (newTrack) => !prev.some((prevTrack) => prevTrack.path === newTrack.path),
  );
  tracks = [...tracks, ...newTracks];

  tracks = tracks.map((track) => {
    if (track.status === undefined) {
      return track;
    }

    if (track.status === "completed") {
      const localMatch = localTracks.find((lt) => lt.path === track.path);
      if (localMatch) {
        return {
          ...localMatch,
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
  const { folders, selectedFolder } = useUIMediaFolderStoreState();
  const {
    data: queriedMediaMetadata,
    isError: isMediaMetadataError,
    isPending: isMediaMetadataPending,
    fetchStatus: mediaMetadataFetchStatus,
  } = useMediaMetadataQuery(selectedFolder || undefined);

  const uiFolderRow = useMemo(
    () =>
      selectedFolder
        ? folders.find(
            (f) =>
              normalizeMediaFolderPathForQuery(f.path) ===
              normalizeMediaFolderPathForQuery(selectedFolder),
          )
        : undefined,
    [folders, selectedFolder],
  );

  const folderStatus = useMemo((): UIMediaFolderStatus => {
    if (!selectedFolder?.trim()) return "idle";
    if (isMediaMetadataError) return "error_loading_metadata";
    if (queriedMediaMetadata) return "ok";
    if (uiFolderRow?.status) return uiFolderRow.status;
    if (isMediaMetadataPending || mediaMetadataFetchStatus === "fetching") return "initializing";
    return "loading";
  }, [
    selectedFolder,
    queriedMediaMetadata,
    isMediaMetadataError,
    isMediaMetadataPending,
    mediaMetadataFetchStatus,
    uiFolderRow?.status,
  ]);

  const mediaMetadata = queriedMediaMetadata;

  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation();
  const { mutateAsync: saveMediaMetadata } = useUpdateMediaMetadataMutation();
  const updateMediaMetadata = useCallback(
    async (
      path: string,
      updaterOrMetadata: MediaMetadata | ((current: MediaMetadata) => MediaMetadata),
    ) => {
      const pathPosix = normalizeMediaFolderPathForQuery(path);
      if (!pathPosix) return;
      const current = await fetchMediaMetadata({ path: pathPosix });
      const next =
        typeof updaterOrMetadata === "function"
          ? updaterOrMetadata(current)
          : updaterOrMetadata;
      await saveMediaMetadata({ pathPosix, metadata: next });
    },
    [fetchMediaMetadata, saveMediaMetadata],
  );

  const {
    jobRecords,
    hasRunningDownload,
    startDownload,
    stopDownload,
    removeDownload,
  } = useDownloadManager({
    platformFolder: mediaMetadata?.mediaFolderPath
      ? Path.toPlatformPath(mediaMetadata.mediaFolderPath)
      : undefined,
    mediaFolderPath: mediaMetadata?.mediaFolderPath,
    onDownloadSucceeded: useCallback(() => {
      if (mediaMetadata?.mediaFolderPath) {
        void fetchMediaMetadata({ path: mediaMetadata.mediaFolderPath });
      }
    }, [mediaMetadata, fetchMediaMetadata]),
  });

  const jobTracks = useMemo(
    () => tracksFromDownloadJobRecords(jobRecords),
    [jobRecords],
  );

  const {
    filePropertyDialog,
    confirmationDialog,
    downloadVideoDialog,
    formatConverterDialog,
    editMediaFileDialog,
  } = useDialogs();
  const [openFilePropertyDialog] = filePropertyDialog;
  const [openConfirmation, closeConfirmation] = confirmationDialog;
  const [openDownloadVideo] = downloadVideoDialog;
  const [openFormatConverter] = formatConverterDialog;
  const [openEditMediaFile] = editMediaFileDialog;
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!mediaMetadata?.mediaFolderPath) {
      setTracks(jobTracks.length > 0 ? jobTracks : []);
      return;
    }

    const musicMediaMetadata = newMusicMediaMetadata(mediaMetadata);
    const newTracks = convertMusicFilesToTracks(musicMediaMetadata.musicFiles);

    setTracks((prev) => {
      const basePrev = prev.filter((t) => !t.jobId);
      const synced = syncTracks(basePrev, newTracks);
      return mergeLibraryTracksWithJobTracks(synced, jobTracks);
    });
  }, [mediaMetadata, jobTracks]);

  const pathSignature = useMemo(
    () =>
      tracks
        .filter((t) => t.path)
        .map((t) => t.path)
        .sort()
        .join("\n"),
    [tracks],
  );

  useEffect(() => {
    if (!mediaMetadata || pathSignature === "") return;

    const controller = new AbortController();
    const tracksToFetch = tracks.filter((t) => t.path);

    (async () => {
      for (const track of tracksToFetch) {
        if (controller.signal.aborted) break;
        try {
          const res = await getMediaTags({ path: track.path! });
          if (controller.signal.aborted) break;
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
                : t,
            ),
          );
        } catch (err) {
          console.warn("[MusicPanel] Error reading tags for", track.path, err);
        }
      }
    })();

    return () => controller.abort();
  }, [mediaMetadata, pathSignature]);

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
      jobId: track.jobId,
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
    } catch (error) {
      console.error('[MusicPanel] Failed to open file:', error);
      toast.error(`Could not open "${trackTitle}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return;

    try {
      await deleteFile(Path.toPlatformPath(pendingDelete.trackPath));

      const updatedFiles = [...pendingDelete.currentFiles];
      updatedFiles.splice(pendingDelete.fileIndex, 1);

      const mediaFolderPath = mediaMetadata?.mediaFolderPath;
      if (!mediaFolderPath) {
        toast.error("Media folder path is not available.");
        return;
      }

      await updateMediaMetadata(
        mediaFolderPath,
        (current: MediaMetadata) => ({
          ...current,
          files: updatedFiles,
        }),
      );

      toast.success(`"${pendingDelete.trackTitle}" has been deleted.`);
      setPendingDelete(null);
      closeConfirmation();
    } catch (error) {
      console.error('[MusicPanel] Failed to delete track:', error);
      toast.error(`Could not delete "${pendingDelete.trackTitle}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [pendingDelete, mediaMetadata, updateMediaMetadata, closeConfirmation]);

  const handleDeleteCancel = useCallback(() => {
    setPendingDelete(null);
    closeConfirmation();
  }, [closeConfirmation]);

  const handleTrackDelete = useCallback(async (event: CustomEvent<TrackDeleteEventDetail>) => {
    const { trackPath, trackTitle } = event.detail;

    try {
      if (!trackPath) {
        toast.error(`Track "${trackTitle}" does not have an associated file path.`);
        return;
      }

      if (!mediaMetadata) {
        toast.error("No media folder is currently selected.");
        return;
      }

      const currentFiles = mediaMetadata.files ?? [];
      const trackPathPosix = Path.posix(trackPath);
      const fileIndex = currentFiles.findIndex((file) => file === trackPathPosix);

      if (fileIndex === -1) {
        toast.error(`Track "${trackTitle}" is not in the current media folder.`);
        return;
      }

      setPendingDelete({
        trackPath,
        trackTitle,
        currentFiles,
        fileIndex,
      });

      openConfirmation({
        title: "Delete Track",
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
  }, [mediaMetadata, openConfirmation, handleDeleteConfirm, handleDeleteCancel]);

  const handleTrackProperties = useCallback((event: CustomEvent<TrackPropertiesEventDetail>) => {
    const { trackId, trackTitle } = event.detail;

    try {
      const track = tracks?.find((t) => t.id === trackId);

      if (!track) {
        toast.error(`Track with ID ${trackId} could not be found.`);
        return;
      }

      openFilePropertyDialog(track);
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
    if (!mediaMetadata?.mediaFolderPath) {
      return;
    }
    openDownloadVideo(Path.toPlatformPath(mediaMetadata.mediaFolderPath));
  }, [openDownloadVideo, mediaMetadata]);

  const handleTrackClick = useCallback((trackId: number) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track || track.status === 'downloading') return;

    if (currentTrackId === trackId) {
      setIsPlaying((prev) => !prev);
    } else {
      setCurrentTrackId(trackId);
      setIsPlaying(true);
    }
  }, [tracks, currentTrackId]);

  useEffect(() => {
    const subscriptions: Array<() => void> = [
      addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        handleTrackOpen,
      ),
      addMusicEventListener<TrackDeleteEventDetail>(
        MUSIC_EVENT_NAMES['track:delete'],
        handleTrackDelete,
      ),
      addMusicEventListener<TrackPropertiesEventDetail>(
        MUSIC_EVENT_NAMES['track:properties'],
        handleTrackProperties,
      ),
      addMusicEventListener<TrackFormatConvertEventDetail>(
        MUSIC_EVENT_NAMES['track:formatConvert'],
        handleTrackFormatConvert,
      ),
      addMusicEventListener<TrackEditTagsEventDetail>(
        MUSIC_EVENT_NAMES['track:editTags'],
        handleTrackEditTags,
      ),
    ];

    return () => {
      for (const unsub of subscriptions) unsub();
    };
  }, [handleTrackOpen, handleTrackDelete, handleTrackProperties, handleTrackFormatConvert, handleTrackEditTags]);

  return (
    <div className='w-full h-full min-h-0 relative flex flex-col'>
      <div className="shrink-0 px-4 pt-4">
        <MusicHeaderV2
          selectedMediaMetadata={mediaMetadata}
          onDownloadClick={handleDownloadClick}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {folderStatus === "initializing" ? (
          <MediaPanelInitializingHint />
        ) : (
          <MusicFileTable
            key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
            data={tableData}
            mediaFolderPath={mediaMetadata?.mediaFolderPath}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            onTrackClick={handleTrackClick}
            hasRunningDownload={hasRunningDownload}
            onDownloadStart={startDownload}
            onDownloadStop={stopDownload}
            onDownloadRemove={(jobId) => void removeDownload(jobId)}
          />
        )}
      </div>
    </div>
  );
}
