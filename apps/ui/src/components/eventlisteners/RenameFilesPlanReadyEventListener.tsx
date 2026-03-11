import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { RenameFilesPlanReady } from "@core/event-types";
import { usePlansStore } from "@/stores/plansStore";
import { useMediaMetadataStore } from "@/stores/mediaMetadataStore";
import { mediaFolderPathEqual } from "@/components/TvShowPanelUtils";
import { toast } from "sonner";

export function RenameFilesPlanReadyEventListener() {
    const fetchPendingPlans = usePlansStore((s) => s.fetchPendingPlans);
    const eventListener = useRef<((event: any) => void) | null>(null);

    useMount(() => {
        eventListener.current = async (_event) => {
            console.log('[RenameFilesPlanReadyEventListener] Received renameFilesPlanReady, refetching pending plans');
            await fetchPendingPlans();
            const { pendingRenamePlans } = usePlansStore.getState();
            if (pendingRenamePlans.length === 0) return;
            const mediaState = useMediaMetadataStore.getState();
            let currentPath = mediaState.mediaMetadatas[mediaState.selectedIndex]?.mediaFolderPath;
            if (pendingRenamePlans.length === 1) {
                const plan = pendingRenamePlans[0];
                if (currentPath == null || !mediaFolderPathEqual(currentPath, plan.mediaFolderPath)) {
                    mediaState.setSelectedByMediaFolderPath(plan.mediaFolderPath);
                    const next = useMediaMetadataStore.getState();
                    currentPath = next.mediaMetadatas[next.selectedIndex]?.mediaFolderPath;
                }
            }
            const matchesSomePlan = pendingRenamePlans.some((p) => mediaFolderPathEqual(currentPath, p.mediaFolderPath));
            if (!matchesSomePlan) {
                toast.info("You have pending rename plan(s). Open the corresponding media folder to review.");
            }
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
