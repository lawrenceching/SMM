import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore";
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata";
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation";
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation";
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys";
import type { MediaMetadata } from "@core/types";
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder";
import {
  MusicFileTable,
  type LocalFileTableRowData,
  type MusicTableRow,
  type JobTableRowStatus,
} from "./MusicFileTable";
import { MusicHeaderV2 } from "./MusicHeaderV2";
import { MediaPanelInitializingHint } from "./MediaPanelInitializingHint";
import { useEffect, useCallback, useState, useMemo, useRef } from "react";
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
import { useJobManager, useJobs } from "@/hooks/useJobOrchestrator";
import { absolutePosixMusicFilePath, displayPathForFile } from "@/lib/transcribeDialogRows";
import { isAbsPath } from "@/lib/path";
import { syncTracks } from "@/lib/musicPanelSyncTracks";
import { LocalFileSubtitleScope, useLocalFileSubtitle } from "./LocalFileSubtitleScope";

interface PendingDelete {
  trackPath: string;
  displayPath: string;
  currentFiles: string[];
  fileIndex: number;
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

  const platformFolder = mediaMetadata?.mediaFolderPath
    ? Path.toPlatformPath(mediaMetadata.mediaFolderPath)
    : undefined;

  const { startJob, stopJob, removeJob } = useJobManager();
  const allJobRecords = useJobs();

  // Download job records for this folder (for rendering download tracks).
  // Only show active jobs (pending / running); completed, failed, and aborted
  // jobs are removed from the list so they don't clutter the track view.
  const jobRecords = useMemo(
    () =>
      allJobRecords.filter(
        (r) =>
          r.type === "download-video" &&
          r.folder === platformFolder &&
          (r.status === "pending" || r.status === "running"),
      ),
    [allJobRecords, platformFolder],
  );
  const hasRunningDownload = useMemo(
    () => jobRecords.some((r) => r.status === "running"),
    [jobRecords],
  );
  const startDownload = useCallback((jobId: string) => void startJob(jobId), [startJob]);
  const stopDownload = useCallback((jobId: string) => stopJob(jobId), [stopJob]);
  const removeDownload = useCallback((jobId: string) => void removeJob(jobId), [removeJob]);

  // When a job completes for this folder, refresh media metadata to pick up new files.
  const runningJobIdsRef = useRef(new Set<string>());
  const fetchMediaMetadataRef = useRef(fetchMediaMetadata);
  fetchMediaMetadataRef.current = fetchMediaMetadata;
  const mediaFolderPathRef = useRef(mediaMetadata?.mediaFolderPath);
  mediaFolderPathRef.current = mediaMetadata?.mediaFolderPath;
  const platformFolderRef = useRef(platformFolder);
  platformFolderRef.current = platformFolder;

  useEffect(() => {
    const pf = platformFolderRef.current;
    const mfp = mediaFolderPathRef.current;
    if (!pf || !mfp) {
      runningJobIdsRef.current = new Set();
      return;
    }
    const prevRunning = runningJobIdsRef.current;
    const hadCompletion = allJobRecords.some(
      (r) =>
        r.folder === pf &&
        (r.status === "succeeded" || r.status === "failed") &&
        prevRunning.has(r.id),
    );
    if (hadCompletion) {
      void fetchMediaMetadataRef.current({ path: mfp });
    }
    runningJobIdsRef.current = new Set(
      allJobRecords.filter((r) => r.folder === pf && r.status === "running").map((r) => r.id),
    );
  }, [allJobRecords]);

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
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<number[]>([]);

  const handleToggleMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode((prev) => {
      if (prev) {
        setSelectedTrackIds([]);
      }
      return !prev;
    });
  }, []);

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

  const musicFileRowsForDialogs = useMemo<LocalFileTableRowData[]>(
    () =>
      tracks
        .filter((t) => !t.jobId && t.path)
        .map((track, index) => ({
          kind: "local" as const,
          id: track.id,
          index,
          path: track.path!,
          title: track.title,
          artist: track.artist ?? "",
          duration: track.duration ?? 0,
          thumbnail: track.thumbnail,
        })),
    [tracks],
  );

  const tableData = useMemo<MusicTableRow[]>(() => {
    return tracks.flatMap((track, index): MusicTableRow[] => {
      if (track.jobId) {
        const status = (track.status ?? "pending") as JobTableRowStatus
        return [
          {
            kind: "job",
            id: track.id,
            index,
            jobId: track.jobId,
            status,
            title: track.title,
            artist: track.artist ?? "",
            duration: track.duration ?? 0,
            thumbnail: track.thumbnail,
          },
        ]
      }
      if (!track.path) return []
      return [
        {
          kind: "local",
          id: track.id,
          index,
          path: track.path,
          title: track.title,
          artist: track.artist ?? "",
          duration: track.duration ?? 0,
          thumbnail: track.thumbnail,
        },
      ]
    })
  }, [tracks]);

  const selectedLocalRows = useMemo(
    () =>
      tableData.filter(
        (row): row is LocalFileTableRowData =>
          row.kind === "local" && selectedTrackIds.includes(row.id),
      ),
    [tableData, selectedTrackIds],
  );

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

      toast.success(`"${pendingDelete.displayPath}" has been deleted.`);
      setPendingDelete(null);
      closeConfirmation();
    } catch (error) {
      console.error('[MusicPanel] Failed to delete track:', error);
      toast.error(`Could not delete "${pendingDelete.displayPath}". ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      const mediaFolderPath = mediaMetadata.mediaFolderPath;
      const fileEntry = currentFiles[fileIndex];
      const fileEntryPosix = fileEntry ? Path.posix(fileEntry) : undefined;
      const absolutePath =
        absolutePosixMusicFilePath({ path: trackPath }, mediaFolderPath) ?? trackPathPosix;
      const displayPath =
        (fileEntryPosix && !isAbsPath(fileEntryPosix) ? fileEntryPosix : undefined) ??
        displayPathForFile(mediaFolderPath, absolutePath) ??
        absolutePath;

      setPendingDelete({
        trackPath,
        displayPath,
        currentFiles,
        fileIndex,
      });

      openConfirmation({
        title: "Delete Track",
        showCloseButton: false,
        content: (
          <DeleteTrackDialog
            displayPath={displayPath}
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
    if (isMultiSelectMode) return;
    const track = tracks.find((t) => t.id === trackId);
    if (!track || track.status === 'downloading') return;
    if (selectedTrackIds.includes(trackId)) return;

    setSelectedTrackIds([trackId]);
    setCurrentTrackId(trackId);
    setIsPlaying(true);
  }, [tracks, selectedTrackIds, isMultiSelectMode]);

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

  const clearSelection = useCallback(() => setSelectedTrackIds([]), []);

  return (
    <div className='w-full h-full min-h-0 relative flex flex-col'>
      <LocalFileSubtitleScope
        platformFolder={platformFolder ?? ""}
        mediaFolderPath={mediaMetadata?.mediaFolderPath}
        folderFiles={mediaMetadata?.files}
        localRows={musicFileRowsForDialogs}
        selectedLocalRows={selectedLocalRows}
        onClearSelection={clearSelection}
      >
        <div className="shrink-0 px-4 pt-4">
          <MusicPanelSubtitleHeader
            mediaMetadata={mediaMetadata}
            onDownloadClick={handleDownloadClick}
            isMultiSelectMode={isMultiSelectMode}
            onToggleMultiSelectMode={handleToggleMultiSelectMode}
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
              isMultiSelectMode={isMultiSelectMode}
              selectedTrackIds={selectedTrackIds}
              onSelectedTrackIdsChange={setSelectedTrackIds}
            />
          )}
        </div>
      </LocalFileSubtitleScope>
    </div>
  );
}

interface MusicPanelSubtitleHeaderProps {
  mediaMetadata?: MediaMetadata
  onDownloadClick?: () => void
  isMultiSelectMode: boolean
  onToggleMultiSelectMode: () => void
}

function MusicPanelSubtitleHeader({
  mediaMetadata,
  onDownloadClick,
  isMultiSelectMode,
  onToggleMultiSelectMode,
}: MusicPanelSubtitleHeaderProps) {
  const subtitle = useLocalFileSubtitle()
  const { availability, headerActions } = subtitle

  return (
    <MusicHeaderV2
      selectedMediaMetadata={mediaMetadata}
      onDownloadClick={onDownloadClick}
      onTranscribeClick={headerActions.onTranscribeClick}
      onTranslateClick={headerActions.onTranslateClick}
      isTranscribeAvailable={availability.isTranscribeAvailable}
      hasTranscribeTargets={subtitle.hasTranscribeTargets}
      isTranslateAvailable={availability.isTranslateAvailable}
      hasTranslateTargets={subtitle.hasTranslateTargets}
      onSynthesizeClick={headerActions.onSynthesizeClick}
      isSynthesizeAvailable={availability.isSynthesizeAvailable}
      hasSynthesizeTargets={subtitle.hasSynthesizeTargets}
      onProcessClick={headerActions.onProcessClick}
      isProcessAvailable={availability.isProcessAvailable}
      hasProcessTargets={subtitle.hasProcessTargets}
      isMultiSelectMode={isMultiSelectMode}
      onToggleMultiSelectMode={onToggleMultiSelectMode}
    />
  )
}
