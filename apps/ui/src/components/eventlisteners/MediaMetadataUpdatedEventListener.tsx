import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { MEDIA_METADATA_UPDATED_EVENT } from "@core/event-types";
import { useMediaMetadata } from "@/providers/media-metadata-provider";
import { useConfig } from "@/providers/config-provider";

export function MediaMetadataUpdatedEventListener() {
    const { refreshMediaMetadata } = useMediaMetadata();
    const { reload: reloadUserConfig } = useConfig();
    const eventListener = useRef<((event: any) => void) | null>(null);

    useMount(() => {
        eventListener.current = (event) => {
            const folderPath = event.detail?.folderPath;
            if (folderPath) {
                console.log(`[MediaMetadataUpdatedEventListener] Received mediaMetadataUpdated event for folder: ${folderPath}`);
                refreshMediaMetadata(folderPath);
            } else {
                console.warn(`[MediaMetadataUpdatedEventListener] mediaMetadataUpdated event missing folderPath in data:`, event.detail);
                reloadUserConfig();
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
