import { useRef } from "react";
import { useLatest, useMount, useUnmount } from "react-use";
import { useQueryClient } from "@tanstack/react-query";
import { FOLDER_CONTENT_CHANGED_EVENT, type FolderContentChangedEventData } from "@core/event-types";
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation";
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore";
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata";
import { associatedFilesQueryKey } from "@/lib/associatedFilesQueryKeys";
import { normalizeMediaFolderPathForQuery } from "@/hooks/mediaMetadata";
import { Path } from "@core/path";
import Debug from 'debug';

const debug = Debug('FolderContentChangedEventListener');

/**
 * Placeholder method for TvShowPanel-specific file change handling.
 * This is called when folder content changes while a TV show folder is selected.
 * Extend this method in the future to implement actual file change reactions.
 */
function onTvShowPanelFileChange(data: FolderContentChangedEventData): void {
  console.log(
    `[FolderContentChangedEventListener] TvShowPanel: File change detected in folder "${data.folderPath}"`,
    data,
  );
  debug('TvShowPanel file change placeholder called', data);
}

/**
 * Placeholder method for MoviePanel-specific file change handling.
 * This is called when folder content changes while a movie folder is selected.
 * Extend this method in the future to implement actual file change reactions.
 */
function onMoviePanelFileChange(data: FolderContentChangedEventData): void {
  console.log(
    `[FolderContentChangedEventListener] MoviePanel: File change detected in folder "${data.folderPath}"`,
    data,
  );
  debug('MoviePanel file change placeholder called', data);
}

export function FolderContentChangedEventListener() {
  const { selectedFolder } = useUIMediaFolderStoreState();
  const { data: selectedMediaMetadata } = useMediaMetadataQuery(selectedFolder || undefined);
  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation();
  const queryClient = useQueryClient();

  // Use useLatest to avoid stale closure in the event handler.
  // The event listener is created once in useMount; without useLatest,
  // the handler closure would capture the initial values forever.
  const latestSelectedFolder = useLatest(selectedFolder);
  const latestSelectedMediaMetadata = useLatest(selectedMediaMetadata);
  const latestFetchMediaMetadata = useLatest(fetchMediaMetadata);

  const eventListener = useRef<((event: Event) => void) | null>(null);

  useMount(() => {
    eventListener.current = (event: Event) => {
      const data = (event as CustomEvent<FolderContentChangedEventData>).detail;
      if (!data?.folderPath) {
        console.warn('[FolderContentChangedEventListener] Event missing folderPath:', data);
        return;
      }

      const eventFolderPosix = Path.posix(data.folderPath);
      const currentSelectedFolder = latestSelectedFolder.current;
      const currentSelectedMetadata = latestSelectedMediaMetadata.current;
      const currentFetchFn = latestFetchMediaMetadata.current;
      const selectedFolderPosix = currentSelectedFolder ? Path.posix(currentSelectedFolder) : undefined;

      console.log(
        `[FolderContentChangedEventListener] Received folderContentChanged event for folder: ${eventFolderPosix}`,
        data,
      );

      // Only react if the changed folder matches the currently selected folder
      if (selectedFolderPosix && eventFolderPosix === selectedFolderPosix) {
        const mediaType = currentSelectedMetadata?.type;

        // 1. Always invalidate associated files query for the affected folder.
        //    All panels (TvShow, Movie, Music) use useGetAssociatedFiles which
        //    lists files in the folder and matches them by stem+extension.
        //    When new files are created (e.g. subtitle .srt), the stale query
        //    would still return the old file list until invalidated.
        const normalized = normalizeMediaFolderPathForQuery(eventFolderPosix);
        if (normalized) {
          queryClient.invalidateQueries({
            queryKey: associatedFilesQueryKey(normalized),
          });
          console.log(
            `[FolderContentChangedEventListener] Invalidated associated files query for: ${normalized}`,
          );
        }

        if (mediaType === 'music-folder') {
          // MusicPanel: additionally refresh media metadata to pick up new/removed files.
          // This triggers the existing MusicPanel useEffect that converts
          // music metadata files to tracks.
          console.log(
            `[FolderContentChangedEventListener] MusicPanel: Refreshing metadata for folder: ${eventFolderPosix}`,
          );
          void currentFetchFn({ path: eventFolderPosix })
            .then(() => {
              console.log(
                `[FolderContentChangedEventListener] MusicPanel: Metadata refreshed successfully for: ${eventFolderPosix}`,
              );
            })
            .catch((error) => {
              console.error(
                `[FolderContentChangedEventListener] MusicPanel: Failed to refresh metadata for ${eventFolderPosix}:`,
                error,
              );
            });
        } else if (mediaType === 'tvshow-folder') {
          onTvShowPanelFileChange(data);
        } else if (mediaType === 'movie-folder') {
          onMoviePanelFileChange(data);
        } else {
          console.log(
            `[FolderContentChangedEventListener] Unhandled media type "${mediaType}" for folder: ${eventFolderPosix}`,
          );
        }
      } else {
        console.log(
          `[FolderContentChangedEventListener] Folder "${eventFolderPosix}" is not currently selected (selected: "${selectedFolderPosix}"), skipping`,
        );
      }
    };

    document.addEventListener('socket.io_' + FOLDER_CONTENT_CHANGED_EVENT, eventListener.current);
  });

  useUnmount(() => {
    if (eventListener.current) {
      document.removeEventListener('socket.io_' + FOLDER_CONTENT_CHANGED_EVENT, eventListener.current);
    }
  });

  return <></>;
}
