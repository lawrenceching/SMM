import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { RecognizeMediaFilePlanReady } from "@core/event-types";
import { usePlansStore, type UIPlan } from "@/stores/plansStore";
import { fetchPlans } from "@/actions/planActions";

export function RecognizeMediaFilePlanReadyEventListener() {
    
    const eventListener = useRef<((event: any) => void) | null>(null);
    const setPlans = usePlansStore((state) => state.setPlans);

    useMount(() => {
        eventListener.current = async (_event) => {
            console.log(RecognizeMediaFilePlanReady.event + ' Received RecognizeMediaFilePlanReady, refetching pending plans');
            const plans: UIPlan[] = await fetchPlans();
            setPlans(plans);
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
