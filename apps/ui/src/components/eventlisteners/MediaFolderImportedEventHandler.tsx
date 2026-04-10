import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { UI_MediaFolderImportedEvent, type OnMediaFolderImportedEventData } from "@/types/eventTypes";
import { Mutex } from "es-toolkit";
import { useInitializeImportedMediaFolder } from "@/hooks/initialization/useInitializeImportedMediaFolder";

const mutex = new Mutex();

export function MediaFolderImportedEventHandler() {
    const { initializeImportedMediaFolder } = useInitializeImportedMediaFolder();
    const eventListener = useRef<((event: Event) => void) | null>(null);

    useMount(() => {
        eventListener.current = (event) => {
            console.log("Socket event:", (event as CustomEvent<OnMediaFolderImportedEventData>).detail);

            (async () => {
                try {
                    console.log(`acquiring mutex for media folder initialization`);
                    await mutex.acquire();
                    console.log(`acquired mutex for media folder initialization`);
                    await initializeImportedMediaFolder(event);
                } catch (error) {
                    console.error("Failed to initialize media folder:", error);
                } finally {
                    mutex.release();
                    console.log(`released mutex for media folder initialization`);
                    const data = (event as CustomEvent<OnMediaFolderImportedEventData>).detail;
                    data.onCompleted?.();
                }
            })();
        };

        document.addEventListener(UI_MediaFolderImportedEvent, eventListener.current);
    });

    useUnmount(() => {
        if (eventListener.current) {
            document.removeEventListener(UI_MediaFolderImportedEvent, eventListener.current);
        }
    });

    return <></>;
}
