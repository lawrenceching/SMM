import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { USER_CONFIG_UPDATED_EVENT } from "@core/event-types";
import { useConfig } from "@/hooks/userConfig";

export function UserConfigUpdatedEventListener() {
    const { refreshUserConfig } = useConfig();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventListener = useRef<((event: any) => void) | null>(null);

    useMount(() => {
        eventListener.current = (_event) => {
            console.log('[DIAG] UserConfigUpdatedEventListener: Received userConfigUpdated, calling refreshUserConfig');
            void refreshUserConfig();
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
