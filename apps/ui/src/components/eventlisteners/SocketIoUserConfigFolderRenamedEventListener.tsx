import { USER_CONFIG_FOLDER_RENAMED_EVENT } from "@core/event-types"
import { useRef } from "react";
import { useLatest, useMount, useUnmount } from "react-use"
import { useConfig } from "@/providers/config-provider";
import { useMediaMetadataStoreState, useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore";
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions";
import { Path } from "@core/path";

/**
 * This is a logical React component that handles the user config folder renamed event.
 * @returns 
 */
export function SocketIoUserConfigFolderRenamedEventListener() {

    const eventListener = useRef<((event: any) => void) | null>(null);
    const { setUserConfig } = useConfig();
    const { mediaMetadatas } = useMediaMetadataStoreState();
    const { setMediaMetadatas } = useMediaMetadataStoreActions();
    const { initializeMediaMetadata } = useMediaMetadataActions();
    const latestMediaMetadatas = useLatest(mediaMetadatas);

    useMount(() => {

        eventListener.current = async (event) => {

            console.log('Socket event:', event.detail);
            const {from, to} = event.detail;
            setUserConfig((prev) => {
              return {
                ...prev,
                folders: prev.folders.map((folder) => folder === from ? to : folder)
              }
            })

            const mediaMetadatas = latestMediaMetadatas.current;
            const fromInPosix = Path.posix(from);
            const index = mediaMetadatas.findIndex((m) => m.mediaFolderPath === fromInPosix);

            if (index < 0) {
              console.error(`[SocketIoUserConfigFolderRenamedEventListener] No media metadata found for path: ${from}`)
              return
            }

            try {
                // Re-initialize metadata for the renamed folder
                const reinitialized = await initializeMediaMetadata(to, "movie-folder"); // Default type, could be improved
                mediaMetadatas[index] = {...reinitialized};
                setMediaMetadatas([...mediaMetadatas]);
                console.log(`[SocketIoUserConfigFolderRenamedEventListener] Reinitialized metadata for renamed folder: ${from} -> ${to}`);
            } catch (error) {
                console.error(`[SocketIoUserConfigFolderRenamedEventListener] Failed to reinitialize metadata for ${to}:`, error);
            }
        };

        document.addEventListener('socket.io_' + USER_CONFIG_FOLDER_RENAMED_EVENT, eventListener.current);

    })

    useUnmount(() => {

        if (eventListener.current) {
            document.removeEventListener('socket.io_' + USER_CONFIG_FOLDER_RENAMED_EVENT, eventListener.current);
        }
        
    })

  return (
    <></>
  )
}