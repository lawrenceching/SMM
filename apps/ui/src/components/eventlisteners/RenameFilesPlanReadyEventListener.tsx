import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { RenameFilesPlanReady } from "@core/event-types";
import { queryClient } from "@/lib/queryClient";
import { PLANS_QUERY_ROOT } from "@/hooks/plans";

export function RenameFilesPlanReadyEventListener() {

    const eventListener = useRef<((event: Event) => void) | null>(null);

    useMount(() => {
        eventListener.current = () => {
            console.log('[RenameFilesPlanReadyEventListener] Received renameFilesPlanReady, invalidating plans query');
            void queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] });
        };

        document.addEventListener('socket.io_' + RenameFilesPlanReady.event, eventListener.current);
    });

    useUnmount(() => {
        if (eventListener.current) {
            document.removeEventListener('socket.io_' + RenameFilesPlanReady.event, eventListener.current);
        }
    });

    return (
        <></>
    )
}
