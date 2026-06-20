import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { RecognizeMediaFilePlanReady } from "@core/event-types";
import { queryClient } from "@/lib/queryClient";
import { PLANS_QUERY_ROOT } from "@/hooks/plans";

export function RecognizeMediaFilePlanReadyEventListener() {

    const eventListener = useRef<((event: Event) => void) | null>(null);

    useMount(() => {
        eventListener.current = () => {
            console.log(RecognizeMediaFilePlanReady.event + ' Received RecognizeMediaFilePlanReady, invalidating plans query');
            void queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] });
        };

        document.addEventListener('socket.io_' + RecognizeMediaFilePlanReady.event, eventListener.current);
    });

    useUnmount(() => {
        if (eventListener.current) {
            document.removeEventListener('socket.io_' + RecognizeMediaFilePlanReady.event, eventListener.current);
        }
    });

    return (
        <></>
    )
}
