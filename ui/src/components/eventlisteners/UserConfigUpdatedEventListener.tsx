import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { USER_CONFIG_UPDATED_EVENT } from "@core/event-types";
import { useConfig } from "@/providers/config-provider";

export function UserConfigUpdatedEventListener() {
    const { reload: reloadUserConfig } = useConfig();
    const eventListener = useRef<((event: any) => void) | null>(null);

    useMount(() => {
        eventListener.current = (_event) => {
            console.log('[UserConfigUpdatedEventListener] Received userConfigUpdated, reloading user config');
            reloadUserConfig();
        };

        document.addEventListener('socket.io_' + USER_CONFIG_UPDATED_EVENT, eventListener.current);
    });

    useUnmount(() => {
        if (eventListener.current) {
            document.removeEventListener('socket.io_' + USER_CONFIG_UPDATED_EVENT, eventListener.current);
        }
    });

    return (
        <></>
    )
}
