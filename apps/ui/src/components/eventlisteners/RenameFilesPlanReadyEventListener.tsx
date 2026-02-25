import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { RenameFilesPlanReady } from "@core/event-types";
import { usePlansStore } from "@/stores/plansStore";

export function RenameFilesPlanReadyEventListener() {
    const { fetchPendingPlans } = usePlansStore();
    const eventListener = useRef<((event: any) => void) | null>(null);

    useMount(() => {
        eventListener.current = (_event) => {
            console.log('[RenameFilesPlanReadyEventListener] Received renameFilesPlanReady, refetching pending plans');
            void fetchPendingPlans();
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
