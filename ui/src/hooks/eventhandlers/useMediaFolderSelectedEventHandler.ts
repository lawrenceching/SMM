import { useMediaMetadata } from "@/providers/media-metadata-provider";
import type { OnMediaFolderSelectedEventData, UIEvent } from "@/types/EventHandlerTypes"
import { useCallback } from "react"


export function useMediaFolderSelectedEventHanlder() {

    const { mediaMetadatas } = useMediaMetadata();

    return useCallback(async (event: UIEvent) => {

        const data = event.data as OnMediaFolderSelectedEventData;
        const { mediaFolderPath, traceId } = data;

        const mm = mediaMetadatas.find(m => m.mediaFolderPath === mediaFolderPath);
        if(mm === undefined) {
            return;
        }

        if(mm.status !== 'ok') {
            console.error(`[${traceId}] Media folder status is not ok: ${mediaFolderPath}`)
            return;
        }

        
        // TODO: 1. try recognize by NFO
        // TODO: 2. try recognize by TMDB ID in folder name
        // TODO: 3. try recognize by folder name
        

    }, [])
}