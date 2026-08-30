import { USER_CONFIG_FOLDER_RENAMED_EVENT } from "@smm/types/event-types"
import { useRef } from "react";
import { useLatest, useMount, useUnmount } from "react-use"
import { useQueryClient } from "@tanstack/react-query"
import { useConfig } from "@/hooks/userConfig";
import { invalidateFoldersQueryIfV3 } from "@/hooks/folders";
import { Path } from "@smm/utils/path";
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata";
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore";
import { nextTraceId } from "@/lib/utils";
/**
 * This is a logical React component that handles the user config folder renamed event.
 * @returns 
 */
export function SocketIoUserConfigFolderRenamedEventListener() {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventListener = useRef<((event: any) => void) | null>(null);
    const { setUserConfig } = useConfig();
    const setFolders = useUIMediaFolderStore((s) => s.setFolders);
    const folders = useUIMediaFolderStore((s) => s.folders);
    const setSelectedFolder = useUIMediaFolderStore((s) => s.setSelectedFolder);
    const latestFolders = useLatest(folders);
    const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation();
    const queryClient = useQueryClient();

    useMount(() => {

        eventListener.current = async (event) => {
            const traceId = `${nextTraceId()}`
            console.log(`[${traceId}] Socket event:`, event.detail);
            
            const {from, to} = event.detail;
            setUserConfig((prev) => {
              return {
                ...prev,
                folders: prev.folders.map((folder) => folder === from ? to : folder)
              }
            })

            setFolders(
              latestFolders.current.map((folder) => folder.path === from ? {
                ...folder,
                path: to
              } : folder))

            setSelectedFolder(to)
            invalidateFoldersQueryIfV3(queryClient)
            fetchMediaMetadata({ path: Path.posix(to), traceId })
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