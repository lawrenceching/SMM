import { USER_CONFIG_FOLDER_RENAMED_EVENT } from "@core/event-types"
import { useRef } from "react";
import { useLatest, useMount, useUnmount } from "react-use"
import { useConfig } from "@/hooks/userConfig";
import { Path } from "@core/path";
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata";
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore";
import { nextTraceId } from "@/lib/utils";
/**
 * This is a logical React component that handles the user config folder renamed event.
 * @returns 
 */
export function SocketIoUserConfigFolderRenamedEventListener() {

    const eventListener = useRef<((event: any) => void) | null>(null);
    const { setUserConfig } = useConfig();
    const setFolders = useUIMediaFolderStore((s) => s.setFolders);
    const folders = useUIMediaFolderStore((s) => s.folders);
    const setSelectedFolder = useUIMediaFolderStore((s) => s.setSelectedFolder);
    const latestFolders = useLatest(folders);
    const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation();

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