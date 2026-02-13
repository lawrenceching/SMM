import { USER_CONFIG_FOLDER_RENAMED_EVENT } from "@core/event-types"
import { useRef } from "react";
import { useLatest, useMount, useUnmount } from "react-use"
import { useConfig } from "@/providers/config-provider";
import { useMediaMetadata } from "@/providers/media-metadata-provider";
import { readMediaMetadataApi } from "@/api/readMediaMatadata";
import { loadUIMediaMetadata } from "@/lib/mediaMetadataUtils";
import { listFiles } from "@/api/listFiles";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { Path } from "@core/path";

/**
 * This is a logical React component that handles the user config folder renamed event.
 * @returns 
 */
export function SocketIoUserConfigFolderRenamedEventListener() {

    const eventListener = useRef<((event: any) => void) | null>(null);
    const { setUserConfig } = useConfig();
    const { mediaMetadatas, setMediaMetadatas } = useMediaMetadata();
    const latestMediaMetadatas = useLatest(mediaMetadatas);

    useMount(() => {

        eventListener.current = (event) => {

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
           
            loadUIMediaMetadata(to, {
              readMediaMetadataApi: readMediaMetadataApi,
              listFilesApi: listFiles,
              callback: (mm: UIMediaMetadata) => {
                mediaMetadatas[index] = {...mm};
                setMediaMetadatas([...mediaMetadatas])
              }
            })
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