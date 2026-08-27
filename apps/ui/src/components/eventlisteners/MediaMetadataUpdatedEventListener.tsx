import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { MEDIA_METADATA_UPDATED_EVENT } from "@core/event-types";
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation";
import { useConfig } from "@/hooks/userConfig";
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys";
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore";

export function MediaMetadataUpdatedEventListener() {
    const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation();
    const { refreshUserConfig } = useConfig();
    const selectedFolder = useUIMediaFolderStore((s) => s.selectedFolder);
    const selectedFolderRef = useRef(selectedFolder);
    selectedFolderRef.current = selectedFolder;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventListener = useRef<((event: any) => void) | null>(null);

    useMount(() => {
        eventListener.current = async (event) => {
            const folderPath = event.detail?.folderPath;
            if (folderPath) {
                const selected = selectedFolderRef.current?.trim();
                if (
                    !selected ||
                    normalizeMediaFolderPathForQuery(selected) !==
                        normalizeMediaFolderPathForQuery(folderPath)
                ) {
                    return;
                }
                console.log(`[MediaMetadataUpdatedEventListener] Received mediaMetadataUpdated event for folder: ${folderPath}`);
                try {
                    await fetchMediaMetadata({ path: folderPath });
                } catch (error) {
                    console.error(`[MediaMetadataUpdatedEventListener] Failed to refresh metadata for ${folderPath}:`, error);
                }
            } else {
                console.warn(`[MediaMetadataUpdatedEventListener] mediaMetadataUpdated event missing folderPath in data:`, event.detail);
                void refreshUserConfig();
            }
        };

        document.addEventListener('socket.io_' + MEDIA_METADATA_UPDATED_EVENT, eventListener.current);
    });

    useUnmount(() => {
        if (eventListener.current) {
            document.removeEventListener('socket.io_' + MEDIA_METADATA_UPDATED_EVENT, eventListener.current);
        }
    });

    return (
        <></>
    )
}
