import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { RenameFilesPlanReady } from "@core/event-types";
import { usePlansStore, type UIPlan } from "@/stores/plansStore";
import { fetchPlans } from "@/actions/planActions";

export function RenameFilesPlanReadyEventListener() {
    
    const eventListener = useRef<((event: any) => void) | null>(null);
    const setPlans = usePlansStore((state) => state.setPlans);

    useMount(() => {
        eventListener.current = async (_event) => {
            console.log('[RenameFilesPlanReadyEventListener] Received renameFilesPlanReady, refetching pending plans');
            const plans: UIPlan[] = await fetchPlans();
            setPlans(plans);
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
