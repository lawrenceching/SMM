import { useMediaMetadata } from "@/providers/media-metadata-provider";
import { MediaPlayer } from "./MediaPlayer";
import { useMemo, useEffect, useRef } from "react";
import { convertMusicFilesToTracks, newMusicMediaMetadata } from "@/lib/music";
import { openFile } from "@/api/openFile";
import { deleteFile } from "@/api/deleteFile";
import { 
  addMusicEventListener, 
  type TrackOpenEventDetail, 
  type TrackDeleteEventDetail, 
  type TrackPropertiesEventDetail,
  MUSIC_EVENT_NAMES 
} from "@/lib/musicEvents";
import { useDialogs } from "@/providers/dialog-provider";
import { toast } from "sonner";
import { Path } from "@core/path";
import { Button } from "./ui/button";

export function MusicPanel() {

  const { selectedMediaMetadata, updateMediaMetadata } = useMediaMetadata();
  const { filePropertyDialog, confirmationDialog } = useDialogs();
  const [openFilePropertyDialog] = filePropertyDialog;
  const [openConfirmation, closeConfirmation] = confirmationDialog;
  const pendingDeleteRef = useRef<{ trackPath: string; trackTitle: string; currentFiles: string[]; fileIndex: number } | null>(null);

  const tracks = useMemo(() => {
    if(!selectedMediaMetadata) {
      return undefined;
    }
    const musicMediaMetadata = newMusicMediaMetadata(selectedMediaMetadata);
    return convertMusicFilesToTracks(musicMediaMetadata.musicFiles);
  }, [selectedMediaMetadata]);

  const handleTrackOpen = async (event: CustomEvent<TrackOpenEventDetail>) => {
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
  };

  const handleTrackDelete = async (event: CustomEvent<TrackDeleteEventDetail>) => {
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
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                pendingDeleteRef.current = null;
                closeConfirmation();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const pendingDelete = pendingDeleteRef.current;
                if (!pendingDelete) {
                  toast.error("Delete operation expired. Please try again.");
                  return;
                }

                try {
                  await deleteFile(Path.toPlatformPath(pendingDelete.trackPath));
                  
                  const updatedFiles = [...pendingDelete.currentFiles];
                  updatedFiles.splice(pendingDelete.fileIndex, 1);

                  const mediaFolderPath = selectedMediaMetadata.mediaFolderPath;
                  if (!mediaFolderPath) {
                    toast.error("Media folder path is not available.");
                    return;
                  }

                  updateMediaMetadata(
                    mediaFolderPath,
                    (current) => ({
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
              }}
            >
              Delete
            </Button>
          </div>
        ),
      });
    } catch (error) {
      console.error('[MusicPanel] Failed to handle delete track:', error);
      toast.error(`Could not process delete for "${trackTitle}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTrackProperties = (event: CustomEvent<TrackPropertiesEventDetail>) => {
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
  };

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

    return () => {
      unsubscribeOpen();
      unsubscribeDelete();
      unsubscribeProperties();
    };
  }, [tracks, selectedMediaMetadata, updateMediaMetadata, filePropertyDialog, openConfirmation]);

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <MediaPlayer tracks={tracks} />
    </div>
  );
}